// Offline outbox. Customers' homes often have no signal, so every write the
// technician makes (workflow step, photo, arrival code) is parked here and
// replayed in order once the phone is back online. IndexedDB, not localStorage:
// photos are ~150KB of base64 each and localStorage caps out around 5MB.

const DB_NAME = "oasis-outbox";
const DB_VERSION = 1;
const STORE = "queue";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        // autoIncrement key doubles as the FIFO order — items must replay in the
        // sequence the technician performed them (arrive → diagnose → payment).
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** A stable id so a replayed item is never applied twice by the backend. */
export const newClientId = () =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

/** Park a write. `kind` is "step" | "photo" | "verifyArrival" | "cancel" | "newCall".
    Pass `clientId` when the write was already ATTEMPTED under that id: the
    attempt may have reached the server, so the replay has to carry the same id
    or the backend cannot tell it is the same write. */
export async function enqueue({ kind, jobId, payload, clientId = newClientId() }) {
  const item = { kind, jobId, payload, clientId, createdAt: Date.now(), tries: 0 };
  await tx("readwrite", (s) => s.add(item));
  notify();
  return item;
}

/** Everything waiting, oldest first. */
export function all() {
  return tx("readonly", (s) => s.getAll());
}

export function remove(id) {
  return tx("readwrite", (s) => s.delete(id)).then(notify);
}

export function update(item) {
  return tx("readwrite", (s) => s.put(item));
}

export async function count() {
  const items = await all();
  return items.length;
}

/** Photos taken for a job that haven't reached the server yet, oldest first.
    Read straight from the queue rather than mirrored into component state: the
    WebView is destroyed on every camera shot, so anything held in memory (or in
    localStorage — these are ~150KB each) would not survive the trip. */
export async function pendingPhotos(jobId) {
  const items = await all();
  return items
    .filter((i) => i.kind === "photo" && String(i.jobId) === String(jobId))
    .map((i) => i.payload?.image)
    .filter(Boolean);
}

/* ---- change notifications so the UI can show a "waiting to sync" badge ---- */
const listeners = new Set();
export function onChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notify() {
  count().then((n) => listeners.forEach((cb) => cb(n))).catch(() => {});
}
