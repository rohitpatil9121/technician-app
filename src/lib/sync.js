// Drains the offline outbox. Every write goes through here. Steps and arrival
// codes try the network first and are parked only when the phone is actually
// offline, so a normal online job behaves exactly as before; photos are always
// parked first and uploaded in the background (see queuedPhoto).

import { api } from "./api.js";
import { enqueue, all, remove, update, onChange, newClientId } from "./outbox.js";
import { remember } from "./photoCache.js";

// A failed fetch (no signal, DNS, timeout) throws TypeError; the API client turns
// a real server response into an Error carrying the status text.
const isOffline = (e) =>
  !navigator.onLine || e instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(e?.message || "");

// Worth another go later: no connection, or the server is temporarily unwell.
// A 4xx means this exact request will never be accepted, so it must not sit in
// the queue blocking everything behind it — but a 5xx must NOT be discarded, or
// a payment recorded during a server blip would be lost for good.
const isRetryable = (e) =>
  isOffline(e) || /\((?:5\d\d|408|429)\)/.test(e?.message || "");

let flushing = false;
let onJob = null;   // set by the app so a synced job can refresh in the UI

/** Called with the server's updated job after each successful replay. */
export function setJobSink(fn) { onJob = fn; }

async function send(item) {
  const { kind, jobId, payload, clientId } = item;
  if (kind === "step") return api.step(jobId, payload.action, payload.work, clientId);
  if (kind === "photo") return api.uploadPhoto(jobId, payload.image, clientId);
  if (kind === "verifyArrival") return api.verifyArrival(jobId, payload.code, clientId);
  if (kind === "cancel") return api.cancelJob(jobId, payload.reason, clientId);
  if (kind === "newCall") return api.addCall(payload.call, clientId);
  throw new Error("unknown outbox kind: " + kind);
}

/** Replay everything waiting, oldest first. Safe to call often. */
export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const items = await all();
    for (const item of items) {
      try {
        const res = await send(item);
        // The photo is now at a URL, and we are holding the only other copy of
        // it. Keep it against that URL so the thumbnail never has to be fetched
        // back over the signal it was uploaded through.
        if (item.kind === "photo" && res?.job) {
          const urls = res.job.work?.tech_photos || [];
          await remember(urls[urls.length - 1], item.payload?.image);
        }
        // Hand the server's job to the UI BEFORE dropping the queue entry.
        // The other order leaves a frame where a just-uploaded photo is in
        // neither list, and the "photo required" gate on the work screen blinks
        // off under the technician's finger.
        if (res?.job && onJob) onJob(res.job);
        await remove(item.id);
      } catch (e) {
        // Offline or a server blip — stop here and keep the queue (and its order)
        // intact so nothing the technician did is lost.
        if (isRetryable(e)) {
          await update({ ...item, lastError: e.message, tries: (item.tries || 0) + 1 });
          return;
        }
        // The server rejected it outright (bad data, job already past this step).
        // Retrying forever would block every later item, so drop it and move on.
        console.error(`outbox drop ${item.kind} for ${item.jobId}:`, e.message);
        await remove(item.id);
      }
    }
  } finally {
    flushing = false;
  }
}

/* Try the network; park the write if the phone is offline.

   The id is minted BEFORE the live attempt and reused when the item is parked,
   because "offline" here covers more than a dead radio: a request that reached
   the server and lost its RESPONSE on the way back also lands in this catch —
   routine on one bar of signal. Minting a fresh id at park time would present
   that replay to the backend as a brand-new write, which for a New Call means a
   second ticket and a second WhatsApp to the customer. Same id, and the backend
   recognises its own work. */
async function tryOrQueue(kind, jobId, payload, call) {
  const clientId = newClientId();
  try {
    return await call(clientId);
  } catch (e) {
    if (!isOffline(e)) throw e;    // a real server error still surfaces to the UI
    await enqueue({ kind, jobId, payload, clientId });
    return { queued: true };
  }
}

export const queuedStep = (jobId, action, work) =>
  tryOrQueue("step", jobId, { action, work }, (cid) => api.step(jobId, action, work, cid));

/* Photos are queue-FIRST, unlike every other write.

   Uploading first meant the technician stood in the customer's house watching a
   spinner while ~200KB of base64 crawled out over one bar of signal — and the
   thumbnail only appeared once the server had written it to storage and read
   the ticket back. Offline was, absurdly, the fast path: the photo was parked
   and drawn instantly. So park it always. The thumbnail comes from the queue,
   the upload happens behind the technician's back, and enqueue's change
   notification kicks flush() straight away — on a good connection the photo is
   still gone within a second, the tap just no longer waits for it. */
export async function queuedPhoto(jobId, image) {
  await enqueue({ kind: "photo", jobId, payload: { image } });
  return { queued: true };
}

export const queuedVerifyArrival = (jobId, code) =>
  tryOrQueue("verifyArrival", jobId, { code }, (cid) => api.verifyArrival(jobId, code, cid));

/* Cancelling with no signal. The reasons a technician cancels from the field —
   nobody home, wrong address, customer changed their mind — are exactly the
   situations where he is standing outside a building with one bar. It used to
   throw, so he had to remember and do it later, or ring the office. */
export const queuedCancel = (jobId, reason) =>
  tryOrQueue("cancel", jobId, { reason }, (cid) => api.cancelJob(jobId, reason, cid));

/* A walk-in taken with no signal. This is the one that matters most: new work
   is usually found in the same basements and stairwells where the signal is
   worst, and losing it means losing the job, not just delaying a status. */
export const queuedNewCall = (call) =>
  tryOrQueue("newCall", null, { call }, (cid) => api.addCall(call, cid));

/** Wire the triggers that drain the queue. Called once at app start. */
export function startSync() {
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") flush();
  });
  onChange(() => flush());        // something new was parked — try straight away
  setInterval(flush, 30000);      // and a slow heartbeat for flaky signal
  flush();
}

export { onChange as onOutboxChange } from "./outbox.js";
