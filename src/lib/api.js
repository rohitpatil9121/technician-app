// Thin API client for the technician backend (/api/tech/*). The token is kept
// in localStorage; in dev, Vite proxies /api to the backend (see vite.config.js).

const TOKEN_KEY = "tech_token";

// Backend base URL. Empty in dev (Vite proxies /api → :3000). In a packaged
// build (APK / hosted site) set VITE_API_BASE to the deployed backend, e.g.
// https://oasis-globe-api.onrender.com — the app then calls ${BASE}/api/...
const BASE = import.meta.env.VITE_API_BASE || "";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

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
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
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
  step: (id, action, work) => req(`/tech/jobs/${id}/step`, { method: "POST", body: { action, work } }),
  parts: () => req("/tech/parts"),
  reviews: () => req("/tech/reviews"),
  setOnline: (is_online) => req("/tech/availability", { method: "PATCH", body: { is_online } }),
  savePushToken: (token) => req("/tech/push-token", { method: "POST", body: { token } }),
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
