// Thin API client for the technician backend (/api/tech/*). The token is kept
// in localStorage; in dev, Vite proxies /api to the backend (see vite.config.js).

const TOKEN_KEY = "tech_token";

// Backend base URL. Empty in dev (Vite proxies /api → :3000). In a packaged
// build (APK / hosted site) set VITE_API_BASE to the deployed backend, i.e.
// https://oasis-service-automation.onrender.com — the app then calls ${BASE}/api/...
const BASE = import.meta.env.VITE_API_BASE || "";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

// URL for a WhatsApp media id, proxied+authed by the backend (/api/media/:id).
// The token rides as ?t= because <img> can't send an Authorization header.
// Anything that is already a URL (a stored https link, or a data: URL from the
// demo stub) is passed straight through rather than nested inside /api/media/.
export const mediaUrl = (id) =>
  /^(https?:|data:|blob:)/.test(String(id))
    ? String(id)
    : `${BASE}/api/media/${id}?t=${getToken() || ""}`;

/* Called when the server rejects our token. Tokens last seven days and nothing
   noticed them running out: the app still believed it was signed in, every call
   came back 401, and the technician was left staring at an empty job list with
   no clue that signing in again would fix it. JobsContext registers a handler
   that logs out, which puts the login screen in front of them. */
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function req(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Only for calls we authenticated: a 401 from the OTP endpoints is a wrong
    // code, and belongs on the login form rather than triggering a logout.
    if (res.status === 401 && auth && token) {
      onUnauthorized?.();
      throw new Error("Your session has expired. Please sign in again.");
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  // Auth (reuses the platform's WhatsApp OTP endpoints)
  requestOtp: (phone) => req("/auth/otp/request", { method: "POST", body: { phone }, auth: false }),
  verifyOtp: (phone, code) => req("/auth/otp/verify", { method: "POST", body: { phone, code }, auth: false }),
  me: () => req("/auth/me"),

  // Technician jobs
  jobs: () => req("/tech/jobs"),
  job: (id) => req(`/tech/jobs/${id}`),
  // client_id rides along so a write replayed from the offline outbox is applied
  // once, even if the first attempt actually reached the server before dropping.
  step: (id, action, work, client_id) => req(`/tech/jobs/${id}/step`, { method: "POST", body: { action, work, client_id } }),
  uploadPhoto: (id, image, client_id) => req(`/tech/jobs/${id}/photo`, { method: "POST", body: { image, client_id } }),
  // Cancel the job from the field. Same endpoint family as the dashboard's
  // cancel, so the customer gets the standard cancellation message.
  cancelJob: (id, reason, client_id) => req(`/tech/jobs/${id}/cancel`, { method: "POST", body: { reason, client_id } }),
  arrivalOtp: (id) => req(`/tech/jobs/${id}/arrival-otp`, { method: "POST" }),
  verifyArrival: (id, code, client_id) => req(`/tech/jobs/${id}/verify-arrival`, { method: "POST", body: { code, client_id } }),
  // "New Call" — technician adds a walk-in customer; returns the created job.
  addCall: (body, client_id) => req("/tech/calls", { method: "POST", body: { ...body, client_id } }),
  parts: () => req("/tech/parts"),
  // Charges, quick-pick amounts and the UPI id — set on the dashboard, read on
  // every app start so nothing about money is baked into the APK.
  config: () => req("/tech/config"),
  reviews: () => req("/tech/reviews"),
  // No earnings call. The app does not show a technician what he has earned —
  // the backend still computes payouts for the office (services/incentives.js),
  // and the dashboard is where they are read.
  setOnline: (is_online) => req("/tech/availability", { method: "PATCH", body: { is_online } }),
  savePushToken: (token) => req("/tech/push-token", { method: "POST", body: { token } }),
  saveLocation: (lat, lng) => req("/tech/location", { method: "POST", body: { lat, lng } }),
};

// Coarse status (sent by JobDetail) → backend step action.
export const STATUS_TO_ACTION = {
  ACCEPTED: "accept",
  ON_THE_WAY: "enroute",
  ARRIVED: "arrive",
  DIAGNOSED: "diagnose",
  ESTIMATE_SENT: "estimate",
  VERIFIED: "approve",
  REJECTED: "reject",
  WORK_DONE: "workdone",
  PAID: "payment",
  CLOSED: "close",
};
