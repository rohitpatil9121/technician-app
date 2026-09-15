// Last job list seen from the server, kept on the device. Without this a
// technician who opens the app with no signal sees an empty screen — the list
// only ever came from the network. Photos aren't cached here (they're URLs);
// this is just the small JSON the screens render.

const KEY = "og-tech-jobs";
const PARTS_KEY = "og-tech-parts";
const REVIEWS_KEY = "og-tech-reviews";

export function loadCachedJobs() {
  try {
    const raw = localStorage.getItem(KEY);
    const rows = raw ? JSON.parse(raw) : null;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function cacheJobs(jobs) {
  try {
    if (!Array.isArray(jobs)) return;
    localStorage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    // Quota or private mode — the app still works, it just can't start offline.
  }
}

export function clearCachedJobs() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/* The parts catalogue, kept on the device for the same reason as the jobs.

   It was fetched fresh on every boot and held only in memory, so a technician
   who opened the app with no signal had an empty parts list — and with no parts
   there is no bill, which is the one thing he is standing in the customer's
   kitchen to produce. Prices and brands change rarely; last night's copy is far
   better than nothing. */
export function loadCachedParts() {
  try {
    const rows = JSON.parse(localStorage.getItem(PARTS_KEY) || "null");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function cacheParts(parts) {
  try {
    if (Array.isArray(parts) && parts.length) localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
  } catch {
    // Quota or private mode — billing then needs a connection, as before.
  }
}

const CONFIG_KEY = "tech_config_v1";

/* Same reasoning as the parts cache: the bill screen must work in a kitchen
   with no signal, and the charges it offers should be the ones the office set
   last time we were online — not whatever the build shipped with. */
export function loadCachedConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    return c && typeof c === "object" ? c : null;
  } catch {
    return null;
  }
}

export function cacheConfig(config) {
  try { if (config && typeof config === "object") localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
  catch { /* quota / private mode */ }
}

export function clearCachedConfig() {
  try { localStorage.removeItem(CONFIG_KEY); } catch { /* ignore */ }
}

export function clearCachedParts() {
  try { localStorage.removeItem(PARTS_KEY); } catch { /* ignore */ }
}

/* The technician's own ratings and the customers' words, kept on the device.

   Read-only, so there is nothing to queue — it just needs to survive a boot
   with no signal instead of showing an empty Reviews tab as though nobody had
   ever rated him. */
export function loadCachedReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) || "null");
  } catch {
    return null;
  }
}

export function cacheReviews(reviews) {
  try {
    if (reviews) localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
  } catch { /* quota */ }
}

export function clearCachedReviews() {
  try { localStorage.removeItem(REVIEWS_KEY); } catch { /* ignore */ }
}

/* Earnings are deliberately NOT shown in the technician app and nothing here
   caches them. The screen that once did was already unrouted and unreachable;
   it has been removed rather than left lying around for someone to wire back
   up. What a technician has earned is the office's figure to share, not the
   app's to display. Payouts are computed from closed tickets on the backend
   (services/incentives.js) and read on the dashboard. */
