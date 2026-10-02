/* The bill → payment path, in a real browser, against the stand-in backend.

   OG-021026-0007: the customer paid Rs. 3,800 and was sent a Rs. 250 bill. The
   server had refused the itemised bill, the app carried on to Payment anyway,
   and only the total ever reached the server. This walks both sides:

     1. the server REFUSES the bill → the technician stays on the bill, sees why,
        and nothing after the estimate (work-done, payment) is sent;
     2. the server ACCEPTS it → the estimate carries the service charge and the
        parts, and work-done and payment carry the same total.

   Run, from technician-app/:
     npm run build
     npm i --no-save playwright-core
     E2E_CHROMIUM=/path/to/chrome node test/e2e/billFlow.mjs   (or E2E_BROWSER=chrome)
*/
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../../dist/", import.meta.url));
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

const pass = [], fail = [];
const check = (ok, label, detail = "") => {
  (ok ? pass : fail).push(label + (detail ? ` — ${detail}` : ""));
  console.log(`${ok ? "  OK  " : " FAIL "} ${label}${detail ? `   (${detail})` : ""}`);
};

async function run({ port, reject }) {
  const server = spawn(process.execPath, ["fakeBackend.mjs", DIST, String(port)], {
    cwd: import.meta.dirname, stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, REJECT_ESTIMATE: reject ? "1" : "" },
  });
  await sleep(700);
  const browser = await chromium.launch(process.env.E2E_CHROMIUM
    ? { executablePath: process.env.E2E_CHROMIUM }
    : { channel: process.env.E2E_BROWSER || "msedge" });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript((img) => { window.__demoCamera = async () => img; }, PHOTO);
  const page = await ctx.newPage();

  const steps = [];   // every workflow step the app sent, with its payload
  page.on("request", (r) => {
    if (/\/step$/.test(new URL(r.url()).pathname)) {
      try { steps.push(JSON.parse(r.postData() || "{}")); } catch { /* ignore */ }
    }
  });
  const tap = async (t) => {
    const el = page.getByText(t, { exact: false }).first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    await el.click();
  };

  try {
    await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle" });
    await page.locator('input[placeholder="98220 11223"]').fill("9822011223");
    await tap("Send Code");
    await page.waitForSelector("text=Enter Code");
    await page.locator('input[inputmode="numeric"]').first().click();
    await page.keyboard.type("123456", { delay: 20 });
    await tap("Verify");
    await page.waitForSelector("text=Akash Kulkarni");
    await tap("Akash Kulkarni"); await sleep(600);
    await tap("Reached"); await tap("Yes, I'm here");
    await page.waitForSelector("text=Purifier Details");
    await page.locator('button[aria-label="Take job photo"]').first().click();
    await page.getByRole("button", { name: "Use photo" }).click();
    await sleep(1200);
    await page.locator('input[placeholder="e.g. Kent RO Grand"]').fill("Kent Grand Plus");
    await tap("Continue");
    await page.waitForSelector("text=Make the Bill");

    // Service ₹250 (the default) + one part at ₹650.
    await page.getByRole("button", { name: "Add Part", exact: true }).click();
    await page.getByRole("button", { name: "Add Kent Sediment filter" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await page.waitForSelector("text=Collect ₹900");
    steps.length = 0;
    await tap("Collect ₹900");
    await sleep(2500);
    const body = await page.locator("body").innerText();
    const actions = steps.map((s) => s.action);

    if (reject) {
      check(/Bill not saved/.test(body), "a refused bill is reported to the technician");
      check(/above MRP/.test(body), "with the server's reason");
      check(/Make the Bill/.test(body) && /Collect ₹900/.test(body), "and he is still on the bill, not on Payment");
      check(!actions.includes("workdone") && !actions.includes("payment"),
        "nothing after the refused estimate was sent", actions.join(", ") || "none");
    } else {
      const est = steps.find((s) => s.action === "estimate")?.work || {};
      const done = steps.find((s) => s.action === "workdone")?.work || {};
      check(est.service_charge === 250, "the estimate carries the service charge", String(est.service_charge));
      check(est.parts?.length === 1 && est.parts[0].price === 650, "and the part at its price", JSON.stringify(est.parts?.map((p) => [p.name, p.price])));
      check(est.total === 900 && done.total === 900, "estimate and work-done agree on the total", `${est.total} / ${done.total}`);
      check(!/Bill not saved/.test(body), "no error on an accepted bill");

      // Take the money in cash and check the payment carries the same figure.
      await tap("Cash");
      await sleep(600);
      const got = page.getByRole("button", { name: /Got|Received|Collected/i }).first();
      if (await got.count()) await got.click();
      const yes = page.getByText("Yes, received").first();
      await yes.waitFor({ state: "visible", timeout: 8000 });
      await yes.click();
      await sleep(2000);
      const pay = steps.find((s) => s.action === "payment")?.work || {};
      check(pay.total === 900, "payment records the same ₹900 the bill showed", String(pay.total));
    }
  } catch (e) {
    check(false, `flow crashed (${reject ? "refused" : "accepted"} bill)`, e.message.split("\n")[0]);
    try { await page.screenshot({ path: `bill-failure-${reject ? "refused" : "accepted"}.png` }); } catch {}
  } finally {
    await browser.close();
    server.kill();
  }
}

console.log("\n=== 1. The server refuses the bill");
await run({ port: 5601, reject: true });
console.log("\n=== 2. The server accepts the bill");
await run({ port: 5602, reject: false });

console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
fail.forEach((f) => console.log("  FAILED: " + f));
process.exit(fail.length ? 1 : 0);
