/* In-browser stand-in for the technician backend.

   Every network call in the app funnels through one seam — `fetch(BASE + "/api" + path)`
   in lib/api.js — so patching window.fetch lets the REAL screens, the REAL
   JobsContext and the REAL status machine run with no server. Nothing in the
   app is aware of this file; it is installed from main.jsx only when the URL
   hash is #/demo, and never imported otherwise.

   Shapes here mirror what the UI actually reads. Notable contracts:
     - job.id is a string (getJob matches useParams by ===)
     - job.rating is null when unrated, never 0
     - verify-arrival returns HTTP 200 with {ok:false} on a wrong code; a non-2xx
       would throw in req() and never reach the "Invalid code" branch
     - /step and /photo must return a COMPLETE job — updateJob replaces wholesale */

const ok = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

/* Placeholder capture. Real photos are jpeg data URLs from the camera; an SVG
   data URL renders identically in an <img> and costs a few hundred bytes. */
const photoDataUrl = (label) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#0E6FC4"/><text x="160" y="126" font-family="system-ui" font-size="20" fill="#fff" text-anchor="middle">${label}</text></svg>`
  );

const PARTS = [
  { id: "p1", name: "RO Membrane 80 GPD", brand: "kent", price: 1800, minPrice: 1500 },
  { id: "p2", name: "Sediment Filter", brand: "kent", price: 350, minPrice: 300 },
  { id: "p3", name: "Carbon Filter", brand: "kent", price: 420, minPrice: 350 },
  { id: "p4", name: "UV Lamp", brand: "aquaguard", price: 950, minPrice: 800 },
  { id: "p5", name: "Pre-filter Candle", brand: "aquaguard", price: 260, minPrice: 200 },
  { id: "p6", name: "Booster Pump", brand: "aquaguard", price: 2400, minPrice: 2000 },
  { id: "p7", name: "Float Valve", brand: "oasis", price: 180, minPrice: 140 },
  { id: "p8", name: "Storage Tank 8L", brand: "oasis", price: 1200, minPrice: 950 },
  { id: "p9", name: "Inlet Tubing (1m)", brand: "other", price: 90, minPrice: 60 },
];

/* One job per status, so every screen state in the flow is reachable by tapping
   rather than by completing the ten steps that precede it. */
const seedJobs = () => [
  {
    id: "1", code: "OG-2841", status: "NEW", name: "Sunita Deshmukh", area: "Kothrud",
    address: "Flat 302, Sai Residency, Kothrud, Pune", phone: "+919820011223",
    model: "Kent Grand Plus", issue: "No water coming from the purifier since yesterday morning.",
    notes: "Please call before coming, gate closes at 8pm.", when: "Today, 10:30 AM",
    visitCharge: 0, tags: ["Warranty Active"], rating: null,
    // Two customer photos so the Reach screen's "tap to open" path is walkable.
    customerPhotos: [photoDataUrl("Customer photo 1"), photoDataUrl("Customer photo 2")],
    work: {},
  },
  {
    id: "2", code: "OG-2842", status: "ON_THE_WAY", name: "Rahul Kulkarni", area: "Baner",
    address: "B-14, Orchid Society, Baner, Pune", phone: "+919820011224",
    model: "Aquaguard Marvel", issue: "Machine is beeping continuously and no purified output.",
    notes: null, when: "Today, 11:15 AM", visitCharge: 250, tags: ["High Priority"],
    rating: null, customerPhotos: [], work: {},
  },
  {
    id: "3", code: "OG-2843", status: "ARRIVED", name: "Priya Nair", area: "Viman Nagar",
    address: "A-701, Nyati Empire, Viman Nagar, Pune", phone: "+919820011225",
    model: "Kent Supreme", issue: "Water tastes odd and there is a slow drip near the tap joint.",
    notes: null, when: "Today, 1:00 PM", visitCharge: 250, tags: [], rating: null,
    customerPhotos: [], work: {},
  },
  {
    id: "4", code: "OG-2844", status: "DIAGNOSED", name: "Imran Shaikh", area: "Kondhwa",
    address: "12, Green Acres, Kondhwa, Pune", phone: "+919820011226",
    model: "Kent Grand", issue: "Very low water flow, tank takes hours to fill.",
    notes: null, when: "Today, 2:30 PM", visitCharge: 250, tags: ["Repeat Complaint"],
    rating: null, customerPhotos: [],
    work: {
      model_name: "Kent Grand", problems: ["Low water flow", "Filter issue"],
      tds_in_tap: "460", tds_in_filter: "48", tech_photos: [photoDataUrl("Site photo")],
    },
  },
  {
    id: "5", code: "OG-2845", status: "ESTIMATE_SENT", name: "Arjun Mehta", area: "Wakad",
    address: "C-9, Rose County, Wakad, Pune", phone: "+919820011227",
    model: "Aquaguard Marvel", issue: "Filter replacement quoted, waiting on customer.",
    notes: null, when: "Yesterday, 4:00 PM", visitCharge: 250, tags: [], rating: null,
    customerPhotos: [],
    work: {
      model_name: "Aquaguard Marvel", problems: ["Filter issue"], charge: "service",
      tds_in_tap: "410", tds_in_filter: "52", total: 1210,
      parts: [{ id: "p5", name: "Pre-filter Candle", brand: "aquaguard", price: 260, minPrice: 200, mrp: 260 },
              { id: "p4", name: "UV Lamp", brand: "aquaguard", price: 950, minPrice: 800, mrp: 950 }],
      tech_photos: [photoDataUrl("Site photo")],
    },
  },
  {
    id: "6", code: "OG-2846", status: "VERIFIED", name: "Kavita Rao", area: "Hinjewadi",
    address: "D-4, Blue Ridge, Hinjewadi, Pune", phone: "+919820011228",
    model: "Kent Grand Plus", issue: "Membrane replacement approved by customer.",
    notes: null, when: "Today, 3:15 PM", visitCharge: 250, tags: [], rating: null,
    customerPhotos: [],
    work: {
      model_name: "Kent Grand Plus", problems: ["Bad taste"], charge: "service",
      tds_in_tap: "520", tds_in_filter: "180", total: 2050, work_started: true,
      parts: [{ id: "p1", name: "RO Membrane 80 GPD", brand: "kent", price: 1800, minPrice: 1500, mrp: 1800 }],
      tech_photos: [photoDataUrl("Site photo")],
    },
  },
  {
    id: "7", code: "OG-2847", status: "REJECTED", name: "Sanjay Patil", area: "Hadapsar",
    address: "5, Amanora Park, Hadapsar, Pune", phone: "+919820011229",
    model: "Aquaguard Enhance", issue: "Customer declined the pump replacement quote.",
    notes: null, when: "Yesterday, 5:30 PM", visitCharge: 250, tags: [], rating: null,
    customerPhotos: [],
    work: {
      model_name: "Aquaguard Enhance", problems: ["Pump issue"], charge: "service", total: 2650,
      tds_in_tap: "395", tds_in_filter: "60",
      parts: [{ id: "p6", name: "Booster Pump", brand: "aquaguard", price: 2400, minPrice: 2000, mrp: 2400 }],
      tech_photos: [photoDataUrl("Site photo")],
    },
  },
  {
    id: "8", code: "OG-2848", status: "WORK_DONE", name: "Neha Gupta", area: "Aundh",
    address: "7, Westend, Aundh, Pune", phone: "+919820011230",
    model: "Kent Supreme", issue: "Filter replaced, ready to collect payment.",
    notes: null, when: "Today, 9:00 AM", visitCharge: 250, tags: [], rating: null,
    customerPhotos: [],
    work: {
      model_name: "Kent Supreme", problems: ["Filter issue"], charge: "service", total: 1020,
      tds_in_tap: "440", tds_in_filter: "45", tds_out_filter: "32", work_started: true,
      parts: [{ id: "p2", name: "Sediment Filter", brand: "kent", price: 350, minPrice: 300, mrp: 350 },
              { id: "p3", name: "Carbon Filter", brand: "kent", price: 420, minPrice: 350, mrp: 420 }],
      tech_photos: [photoDataUrl("Site photo")],
    },
  },
  {
    id: "9", code: "OG-2849", status: "PAID", name: "Vikram Joshi", area: "Shivaji Nagar",
    address: "22, FC Road, Shivaji Nagar, Pune", phone: "+919820011231",
    model: "Kent Grand", issue: "Annual service completed, paid by UPI.",
    notes: null, when: "Today, 8:15 AM", visitCharge: 250, tags: [], rating: null,
    customerPhotos: [],
    work: {
      model_name: "Kent Grand", problems: ["Bad taste"], charge: "service", total: 1450,
      tds_in_tap: "480", tds_in_filter: "40", tds_out_filter: "30", work_started: true,
      mode: "Cash + UPI", split: true,
      payments: [{ method: "Cash", amount: 500 }, { method: "UPI", amount: 950 }],
      parts: [{ id: "p1", name: "RO Membrane 80 GPD", brand: "kent", price: 1200, minPrice: 1500, mrp: 1800 }],
      tech_photos: [photoDataUrl("Site photo")],
    },
  },
  {
    id: "10", code: "OG-2850", status: "CLOSED", name: "Meera Kulkarni", area: "Karve Nagar",
    address: "9, Shreeram Society, Karve Nagar, Pune", phone: "+919820011232",
    model: "Aquaguard Enhance", issue: "Leak fixed and tested.",
    notes: null, when: "Today, 7:30 AM", visitCharge: 250, tags: [], rating: 5, collected: 350,
    customerPhotos: [],
    work: {
      model_name: "Aquaguard Enhance", problems: ["Leakage"], charge: "service", total: 350,
      tds_in_tap: "430", tds_in_filter: "38", tds_out_filter: "28", work_started: true,
      mode: "Cash", payments: [{ method: "Cash", amount: 350 }],
      parts: [], nextService: "6 months", tech_photos: [photoDataUrl("Site photo")],
    },
  },
].map((j) => ({ ...j, bucket: ["ON_THE_WAY", "ESTIMATE_SENT", "REJECTED"].includes(j.status) ? "pending" : "today" }));

const REVIEWS = {
  average: 4.7, jobsRated: 38, thisWeek: 4.9, fiveStar: 31, topStreak: 5, needsWork: 3,
  distribution: [
    { stars: 5, count: 31 }, { stars: 4, count: 4 }, { stars: 3, count: 2 },
    { stars: 2, count: 1 }, { stars: 1, count: 0 },
  ],
  categories: [
    { label: "Punctuality", score: 4.8 }, { label: "Workmanship", score: 4.7 },
    { label: "Behaviour", score: 4.9 }, { label: "Cleanliness", score: 4.5 },
  ],
  recent: [
    { name: "Meera Kulkarni", stars: 5, ticket: "OG-2850", at: "2026-07-21T07:55:00Z", label: "Excellent", text: "Fixed the leak quickly and cleaned up after." },
    { name: "Vikram Joshi", stars: 5, ticket: "OG-2849", at: "2026-07-21T04:20:00Z", label: "Excellent", text: "Very professional, explained the TDS readings." },
    { name: "Anil Bhosale", stars: 4, ticket: "OG-2831", at: "2026-07-20T11:10:00Z", label: "Good", text: "Good work, arrived a little late." },
    { name: "Rekha Jadhav", stars: 3, ticket: "OG-2822", at: "2026-07-19T09:40:00Z", label: "Okay" },
  ],
};

const earnings = () => {
  const days = [];
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(2026, 6, 21 - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const billing = i === 0 ? 8400 : [0, 4200, 9800, 12400, 6100, 11200, 7300][i % 7];
    const payout = Math.round(billing * 0.07);
    days.push({
      date: iso, billing, payout, target_hit: billing >= 10000, brand_rate: billing >= 10000 ? 0.1 : 0.06,
      jobs: billing === 0 ? [] : [
        { ticket_id: `OG-${2800 + i}`, payout: Math.round(payout * 0.6), payment_mode: i % 3 === 0 ? "online" : "cash", parts: [{ brand: "kent" }] },
        { ticket_id: `OG-${2700 + i}`, payout: payout - Math.round(payout * 0.6), payment_mode: "cash", parts: [{ brand: "aquaguard" }, { brand: "oasis" }] },
      ],
    });
  }
  return {
    total_payout: days.reduce((s, d) => s + d.payout, 0),
    total_billing: days.reduce((s, d) => s + d.billing, 0),
    days,
  };
};

/* The backend's step machine, reduced to what the UI needs back: the status the
   job lands in, and the work patch merged in. */
const ACTION_STATUS = {
  accept: "ACCEPTED", enroute: "ON_THE_WAY", arrive: "ARRIVED", diagnose: "DIAGNOSED",
  estimate: "VERIFIED", approve: "VERIFIED", reject: "REJECTED",
  workdone: "WORK_DONE", payment: "PAID", close: "CLOSED",
};

export function installMockApi() {
  const jobs = seedJobs();
  const find = (id) => jobs.find((j) => j.id === String(id));
  const real = window.fetch.bind(window);

  window.__demoCamera = async () => photoDataUrl("Captured " + new Date().toLocaleTimeString("en-IN"));

  /* Unmissable marker. Demo data looks plausible enough to be mistaken for a
     real technician's day, and that mistake is expensive. */
  const badge = document.createElement("div");
  badge.textContent = "DEMO DATA — no backend · ?demo=0 to exit";
  badge.style.cssText =
    "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#C77700;color:#fff;" +
    "font:600 11px system-ui;text-align:center;padding:3px;letter-spacing:.04em;pointer-events:none";
  document.addEventListener("DOMContentLoaded", () => document.body.appendChild(badge));
  if (document.body) document.body.appendChild(badge);

  window.fetch = async (url, opts = {}) => {
    const href = typeof url === "string" ? url : url.url;
    const path = href.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (!path.startsWith("/api")) return real(url, opts);

    const body = opts.body ? JSON.parse(opts.body) : {};
    await new Promise((r) => setTimeout(r, 140)); // visible latency, so loading states show

    if (path === "/api/auth/otp/request") return ok({ ok: true });
    if (path === "/api/auth/otp/verify") return ok({ token: "demo-token", user: { full_name: "Ramesh Patil" } });
    if (path === "/api/auth/me") return ok({ user: { full_name: "Ramesh Patil" } });
    if (path === "/api/tech/jobs") return ok({ jobs });
    if (path === "/api/tech/calls") {
      const b = JSON.parse(opts?.body || "{}");
      const job = {
        id: "nc" + Date.now().toString(36), code: "OG-NEW", status: "NEW", bucket: "today",
        name: b.name || "New Customer", phone: b.phone ? "+91" + b.phone : "", area: b.area || "",
        address: (b.area || "") + ", Pune", model: "—", issue: b.problem || "—",
        when: "Today, just now", visitCharge: 250, tags: [], rating: null,
        customerPhotos: [], work: { added_by_tech: true },
      };
      jobs.unshift(job);
      return ok({ job });
    }
    if (path === "/api/tech/parts") return ok({ parts: PARTS });
    // What the dashboard's Settings page would hand a real technician. The
    // odd preset (₹500) is deliberate: proof on screen that the bill buttons
    // come from here, not from the shipped defaults in data/charges.js.
    if (path === "/api/tech/config") return ok({ config: {
      service_charge: 250, installation_charge: null, service_presets: [0, 250, 350, 500],
      service_max: 1500, upi_id: "oasisglobe@upi", upi_payee: "Oasis Globe Services",
    } });
    if (path === "/api/tech/reviews") return ok({ reviews: REVIEWS });
    if (path === "/api/tech/earnings") return ok(earnings());
    if (path === "/api/tech/availability" || path === "/api/tech/push-token" || path === "/api/tech/location") return ok({ ok: true });

    const step = path.match(/^\/api\/tech\/jobs\/([^/]+)\/step$/);
    if (step) {
      const job = find(step[1]);
      if (!job) return ok({ error: "Not found" });
      job.status = ACTION_STATUS[body.action] || job.status;
      job.work = { ...job.work, ...(body.work || {}) };
      if (job.status === "CLOSED") job.bucket = "today";
      return ok({ job: { ...job } });
    }

    const photo = path.match(/^\/api\/tech\/jobs\/([^/]+)\/photo$/);
    if (photo) {
      const job = find(photo[1]);
      if (!job) return ok({ error: "Not found" });
      job.work = { ...job.work, tech_photos: [...(job.work.tech_photos || []), body.image] };
      return ok({ job: { ...job } });
    }

    if (/^\/api\/tech\/jobs\/[^/]+\/arrival-otp$/.test(path)) return ok({ ok: true });

    const verify = path.match(/^\/api\/tech\/jobs\/([^/]+)\/verify-arrival$/);
    if (verify) {
      const job = find(verify[1]);
      // Any 4-digit code except 0000 passes, so the failure path is walkable too.
      if (body.code === "0000") return ok({ ok: false, error: "Invalid code. Ask the customer to read it again." });
      job.status = "ARRIVED";
      return ok({ ok: true, job: { ...job } });
    }

    return ok({ error: `Demo backend has no route for ${path}` });
  };
}
