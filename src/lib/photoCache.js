// A copy of every photo the technician took, kept on the phone and keyed by the
// URL the server gave it back under.
//
// Once a photo has uploaded, the job carries a URL and the screens render an
// <img> pointing at it — so the phone downloads, over the same weak signal, an
// image it took itself and still has. With no signal at all the thumbnails are
// simply blank, which reads as "my photos are gone" to the technician who just
// took them.
//
// A separate IndexedDB from the outbox on purpose: this is a cache and may be
// cleared at any time, while the outbox holds work that has not reached the
// office yet and must never be thrown away.

const DB_NAME = "oasis-photo-cache";
const DB_VERSION = 1;
const STORE = "photos";

// Roughly 60 × ~150KB ≈ 9MB. Enough for days of jobs, small enough that the
// browser is unlikely to evict the outbox to make room for it.
const MAX_ENTRIES = 60;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "url" });
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
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/** Keep the local copy of a photo under the URL it now lives at. */
export async function remember(url, dataUrl) {
  if (!url || !dataUrl || !String(dataUrl).startsWith("data:")) return;
  try {
    await tx("readwrite", (s) => s.put({ url, dataUrl, at: Date.now() }));
    await trim();
  } catch {
    // A cache that cannot write is just a cache that misses.
  }
}

/** The local copy, or null. */
export async function lookup(url) {
  if (!url) return null;
  try {
    const hit = await tx("readonly", (s) => s.get(url));
    return hit?.dataUrl || null;
  } catch {
    return null;
  }
}

/** Drop the oldest entries once the cache outgrows its budget. */
async function trim() {
  const all = await tx("readonly", (s) => s.getAll());
  if (!Array.isArray(all) || all.length <= MAX_ENTRIES) return;
  const doomed = all.sort((a, b) => a.at - b.at).slice(0, all.length - MAX_ENTRIES);
  for (const d of doomed) await tx("readwrite", (s) => s.delete(d.url));
}

export async function clearPhotoCache() {
  try { await tx("readwrite", (s) => s.clear()); } catch { /* ignore */ }
}
