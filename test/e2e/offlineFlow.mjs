/* Walks the technician app through a whole job in a real browser: login, the
   workflow steps, photos, losing signal mid-job, restarting with no signal, and
   coming back.

   This is the SHIPPED bundle (technician-app/dist) served from the same origin
   as a stand-in backend, so api.js, sync.js, the IndexedDB outbox and the caches
   are all the real thing. Three pieces are substituted, each the way the app
   itself provides for:

     - the camera, through window.__demoCamera, the hook camera.js already
       honours because the native camera cannot run in a browser;
     - the network, by failing every /api call while leaving the static files
       served. That is exactly the APK's situation: its HTML and JS are bundled
       inside the app and always load, only the server is unreachable. Cutting
       the whole connection instead would fail to load the app at all, which is
       a browser-only problem the phone does not have;
     - navigator.onLine, which the browser keeps reporting true, so it is
       overridden to match.

   What this CANNOT prove is the native half: Android destroying the WebView
   while the camera is open. That still needs a phone.

   Run, from technician-app/:
     npm run build
     npm i -D playwright-core            # once; drives the installed Edge
     node test/e2e/offlineFlow.mjs
*/
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import { fileURLToPath } from "node:url";
const DIST = fileURLToPath(new URL("../../dist/", import.meta.url));
const PORT = 5599;
const BASE = `http://localhost:${PORT}`;
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

const pass = [], fail = [];
const check = (ok, label, detail = "") => {
  (ok ? pass : fail).push(label + (detail ? ` — ${detail}` : ""));
  console.log(`${ok ? "  OK  " : " FAIL "} ${label}${detail ? `   (${detail})` : ""}`);
};

const server = spawn(process.execPath, ["fakeBackend.mjs", DIST, String(PORT)], {
  cwd: import.meta.dirname, stdio: ["ignore", "pipe", "pipe"],
});
server.stderr.on("data", (d) => process.stderr.write(`[srv!] ${d}`));
await sleep(700);

// Drives the installed Edge by default; E2E_BROWSER=chrome on a machine without it.
// E2E_CHROMIUM=/path/to/chrome runs a bundled Chromium instead (CI, Linux).
const browser = await chromium.launch(process.env.E2E_CHROMIUM
  ? { executablePath: process.env.E2E_CHROMIUM }
  : { channel: process.env.E2E_BROWSER || "msedge" });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });

let offline = false;                       // the radio, as far as the app can tell
await ctx.addInitScript((img) => {
  window.__demoCamera = async () => img;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true, get: () => !window.__offline,
  });
}, PHOTO);
await ctx.route("**/api/**", (route) => (offline ? route.abort("internetdisconnected") : route.continue()));

const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));

const apiHits = [];
page.on("requestfinished", (r) => { if (r.url().includes("/api/")) apiHits.push(new URL(r.url()).pathname); });

const setOffline = async (v) => {
  offline = v;
  await page.evaluate((o) => {
    window.__offline = o;
    window.dispatchEvent(new Event(o ? "offline" : "online"));
  }, v);
};

const outbox = () => page.evaluate(() => new Promise((res) => {
  const rq = indexedDB.open("oasis-outbox", 1);
  rq.onsuccess = () => {
    const db = rq.result;
    if (!db.objectStoreNames.contains("queue")) return res([]);
    const g = db.transaction("queue", "readonly").objectStore("queue").getAll();
    g.onsuccess = () => res(g.result.map((i) => ({ kind: i.kind, clientId: i.clientId })));
    g.onerror = () => res([]);
  };
  rq.onerror = () => res([]);
}));

const tapText = async (t) => {
  const el = page.getByText(t, { exact: false }).first();
  await el.waitFor({ state: "visible", timeout: 8000 });
  await el.click();
};
// Every shot now stops at a confirm screen first — nothing is queued until the
// technician taps "Use photo". shoot() is camera + confirm, as he does it.
const cam = () => page.locator('button[aria-label="Take job photo"]').first();
const shoot = async () => {
  await cam().click();
  const use = page.getByRole("button", { name: "Use photo" });
  await use.waitFor({ state: "visible", timeout: 8000 });
  await use.click();
};
const thumbs = () => page.locator('img[alt="Job photo"], img[alt="Job photo waiting to upload"]').count();

try {
  console.log("\n=== 1. Login");
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator('input[placeholder="98220 11223"]').fill("9822011223");
  await tapText("Send Code");
  await page.waitForSelector("text=Enter Code", { timeout: 8000 });
  await page.locator('input[inputmode="numeric"]').first().click();
  await page.keyboard.type("123456", { delay: 25 });
  await tapText("Verify");
  await page.waitForSelector("text=Akash Kulkarni", { timeout: 10000 });
  check(true, "logged in over OTP and the job list rendered");

  console.log("\n=== 2. Open the job and start it");
  await tapText("Akash Kulkarni");
  await sleep(700);
  await tapText("Reached");
  await tapText("Yes, I'm here");
  await page.waitForSelector("text=Purifier Details", { timeout: 8000 });
  check(true, "Reached accepted, the work screen opened");

  console.log("\n=== 3. Photo on a good connection");
  const t0 = Date.now();
  await shoot();
  await page.waitForFunction(() => document.querySelector('img[alt^="Job photo"]') !== null, { timeout: 6000 });
  const ms = Date.now() - t0;
  check(ms < 1500, "thumbnail appears without waiting for the upload", `${ms}ms`);
  const beforeUpload = apiHits.length;
  await sleep(3000);
  check(apiHits.slice(beforeUpload).some((h) => /\/photo$/.test(h)) || apiHits.some((h) => /\/photo$/.test(h)),
    "and the upload happened in the background");
  check((await outbox()).length === 0, "the queue is empty again once it landed");

  console.log("\n=== 4. Wi-Fi and mobile data off");
  await setOffline(true);
  await shoot(); await sleep(700);
  await shoot(); await sleep(700);
  const q1 = await outbox();
  check(q1.length === 2, "both photos taken offline are parked", `${q1.length} queued`);
  check(q1.every((i) => i.clientId), "each carries a client_id so a replay is recognised");
  check(await thumbs() >= 3, "the technician still sees every photo he has taken", `${await thumbs()} on screen`);

  console.log("\n=== 5. Fill the form and press on, still with no signal");
  await page.locator('input[placeholder="e.g. Kent RO Grand"]').fill("Kent Grand Plus");
  await tapText("Continue");
  await sleep(1200);
  const q2 = await outbox();
  check(q2.length >= 3, "the workflow step queued behind the photos, in order", `${q2.map((i) => i.kind).join(", ")}`);
  check(q2[0].kind === "photo" && q2.at(-1).kind === "step", "oldest first: photos before the step it belongs to");

  console.log("\n=== 6. Close and reopen the app, still offline");
  await page.reload({ waitUntil: "domcontentloaded" });
  await sleep(2000);
  const body = await page.locator("body").innerText();
  check(/Akash Kulkarni/.test(body), "the job list is still there, from the phone's own copy");
  const q3 = await outbox();
  check(q3.length === q2.length, "nothing queued was lost across the restart", `${q3.length} still queued`);

  console.log("\n=== 7. Signal comes back");
  const beforeDrain = apiHits.length;
  await setOffline(false);
  await sleep(5000);
  const q4 = await outbox();
  check(q4.length === 0, "the queue drained on its own, with no tap from anyone", `${q4.length} left`);
  const sent = apiHits.slice(beforeDrain);
  const order = sent.filter((h) => /\/photo$|\/step$/.test(h)).map((h) => (/\/photo$/.test(h) ? "photo" : "step"));
  check(order.join(",").startsWith("photo,photo"), "replayed in the order the technician did them", order.join(", "));

  console.log("\n=== 8. Console");
  const real = consoleErrors.filter((e) => !/Failed to fetch|net::ERR|NetworkError|Load failed|ERR_INTERNET|401|Unauthorized/i.test(e));
  check(real.length === 0, "no unexpected errors", real.slice(0, 2).join(" | ") || "clean");

  await page.screenshot({ path: "flow-final.png" });
} catch (e) {
  check(false, "flow crashed", e.message.split("\n")[0]);
  try { await page.screenshot({ path: "flow-failure.png" }); } catch {}
} finally {
  console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
  fail.forEach((f) => console.log("  FAILED: " + f));
  await browser.close();
  server.kill();
}
