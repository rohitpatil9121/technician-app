/* A stand-in for the technician backend, just faithful enough to walk the app
   through a whole job. Serves the real built dist from the same origin, so the
   app's own api.js talks to it exactly as it talks to Render.

   It also records every request, which is how the test tells "the app queued
   this" apart from "the app sent this". */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST = process.argv[2];
const PORT = Number(process.argv[3] || 5599);

export const received = [];          // every /api call, in order

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json",
};

const job = (over = {}) => ({
  id: "job-1", code: "OG-TEST-0001", name: "Akash Kulkarni", phone: "+919999999999",
  area: "Kothrud", address: "Flat 3, Kothrud, Pune", when: "Today", bucket: "today",
  model: "Kent Grand", issue: "NOT WORKING", notes: "", lastService: null,
  visitCharge: 250, tags: [], status: "NEW", work: {}, rating: null, ...over,
});

const state = {
  jobs: [job()],
  parts: [
    { id: "p1", name: "Kent Sediment filter", brand: "kent", price: 650, minPrice: 0 },
    { id: "p2", name: "Oasis Carbon Filter", brand: "oasis", price: 450, minPrice: 350 },
  ],
};

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": type, "Access-Control-Allow-Origin": "*" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};

const readBody = (req) => new Promise((r) => {
  let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } });
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const path = url.pathname;

  if (path.startsWith("/api/")) {
    const body = await readBody(req);
    received.push({ method: req.method, path, body });
    const j = state.jobs[0];

    if (path === "/api/auth/otp/request") return send(res, 200, { ok: true });
    if (path === "/api/auth/otp/verify") return send(res, 200, { token: "t-123", user: { id: "u1", full_name: "Shubham Jadhav", role: "technician" } });
    if (path === "/api/auth/me") return send(res, 200, { user: { id: "u1", full_name: "Shubham Jadhav", role: "technician" } });
    if (path === "/api/tech/jobs") return send(res, 200, { jobs: state.jobs });
    if (path === "/api/tech/parts") return send(res, 200, { parts: state.parts });
    if (path === "/api/tech/reviews") return send(res, 200, { reviews: { average: 4.8, count: 12, items: [] } });

    if (/\/step$/.test(path)) {
      // Mirror the real step machine loosely: the action becomes the status.
      const map = { accept: "ACCEPTED", enroute: "ON_THE_WAY", arrive: "ARRIVED", diagnose: "DIAGNOSED",
        estimate: "ESTIMATE_SENT", approve: "VERIFIED", workdone: "WORK_DONE", payment: "PAID", close: "CLOSED" };
      j.status = map[body.action] || j.status;
      j.work = { ...j.work, ...(body.work || {}), tech_status: j.status };
      return send(res, 200, { job: j });
    }
    if (/\/photo$/.test(path)) {
      const n = (j.work.tech_photos || []).length + 1;
      j.work = { ...j.work, tech_photos: [...(j.work.tech_photos || []), `http://localhost:${PORT}/uploaded-${n}.jpg`] };
      return send(res, 200, { ok: true, job: j });
    }
    if (/\/arrival-otp$/.test(path)) return send(res, 200, { ok: true });
    if (/\/verify-arrival$/.test(path)) { j.status = "ARRIVED"; j.work = { ...j.work, tech_status: "ARRIVED" }; return send(res, 200, { job: j }); }
    if (path === "/api/tech/calls") {
      const nu = job({ id: `job-${state.jobs.length + 1}`, code: `OG-TEST-000${state.jobs.length + 1}`, name: body.name || "Walk-in" });
      state.jobs.push(nu);
      return send(res, 200, { job: nu });
    }
    return send(res, 200, { ok: true });
  }

  // Static: the real dist, so the app under test is the shipped bundle.
  let file = path === "/" ? "/index.html" : path;
  let full = join(DIST, normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (!existsSync(full)) full = join(DIST, "index.html");     // SPA fallback
  try {
    send(res, 200, await readFile(full), TYPES[extname(full)] || "application/octet-stream");
  } catch {
    send(res, 404, "not found", "text/plain");
  }
});

server.listen(PORT, () => console.log(`fake backend + app on http://localhost:${PORT}`));

export { state, server };
