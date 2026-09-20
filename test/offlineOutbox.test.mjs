// The offline write path: what the technician's phone does with a step, a
// photo, a cancellation or a new call when the signal is bad — which, in a
// customer's kitchen or a basement stairwell, is most of the time.
//
// The outbox's own IndexedDB mechanics are stubbed here (in-memory, same
// contract). What is under test is sync.js: which writes go to the network
// first, which are parked on sight, what identity a replay carries, and what
// the drain does with a rejection.
//
// Run: node --test --experimental-test-module-mocks test/offlineOutbox.test.mjs

import { test, mock, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

// flush() refuses to run when the phone says it is offline.
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true }, configurable: true, writable: true,
});

let queue;          // the parked items, oldest first
let apiCalls;       // every network attempt, in order
let nextResult;     // (call) => result | throws — set per test
let remembered;     // photos kept on the phone against their uploaded URL

/* Errors as the app really sees them. A dead radio and a request whose RESPONSE
   was lost both surface as TypeError from fetch — indistinguishable, which is
   the whole reason replays need a stable id. A server that answered turns into
   an Error carrying the status. */
const networkFailure = () => new TypeError("Failed to fetch");
const serverError = (status) => new Error(`Request failed (${status})`);

function resetWorld() {
  queue = [];
  apiCalls = [];
  remembered = [];
  nextResult = () => ({ ok: true });
}

const record = (kind, args) => {
  apiCalls.push({ kind, ...args });
  return nextResult({ kind, ...args });
};

/* Put the phone out of signal for the duration of `fn`. Both halves matter:
   navigator.onLine is what flush() consults, and the throwing fetch is what the
   live attempt inside tryOrQueue actually hits. Setting only the flag would let
   the fake network succeed and nothing would ever be parked. */
async function offline(fn) {
  const before = nextResult;
  globalThis.navigator.onLine = false;
  nextResult = () => { throw networkFailure(); };
  try { await fn(); } finally {
    globalThis.navigator.onLine = true;
    nextResult = before;
  }
}

let sync;

before(async () => {
  const url = (p) => new URL(p, import.meta.url).href;

  mock.module(url("../src/lib/api.js"), {
    namedExports: {
      api: {
        step: (jobId, action, work, cid) => record("step", { jobId, action, cid }),
        uploadPhoto: (jobId, image, cid) => record("photo", { jobId, image, cid }),
        verifyArrival: (jobId, code, cid) => record("verifyArrival", { jobId, code, cid }),
        cancelJob: (jobId, reason, cid) => record("cancel", { jobId, reason, cid }),
        addCall: (call, cid) => record("newCall", { call, cid }),
      },
    },
  });

  // Same contract as src/lib/outbox.js, without IndexedDB.
  let autoId = 0;
  mock.module(url("../src/lib/outbox.js"), {
    namedExports: {
      newClientId: () => `c_${++autoId}`,
      enqueue: async ({ kind, jobId, payload, clientId }) => {
        const item = { id: ++autoId, kind, jobId, payload, clientId: clientId ?? `c_auto_${autoId}`, tries: 0 };
        queue.push(item);
        return item;
      },
      all: async () => queue.map((i) => ({ ...i })),
      remove: async (id) => { queue = queue.filter((i) => i.id !== id); },
      update: async (item) => { queue = queue.map((i) => (i.id === item.id ? item : i)); },
      count: async () => queue.length,
      onChange: () => () => {},
      pendingPhotos: async () => [],
    },
  });

  mock.module(url("../src/lib/photoCache.js"), {
    namedExports: { remember: async (u, d) => { remembered.push({ url: u, dataUrl: d }); } },
  });

  sync = await import(url("../src/lib/sync.js"));
});

beforeEach(() => { resetWorld(); globalThis.navigator.onLine = true; });

/* ---------------- photos: parked first, always ---------------- */

test("a photo is parked without waiting for the upload, even on a good connection", async () => {
  const res = await sync.queuedPhoto("job-1", "data:image/jpeg;base64,AAAA");

  assert.equal(res.queued, true);
  assert.equal(apiCalls.length, 0, "the technician's tap must not wait on the network");
  assert.equal(queue.length, 1);
  assert.equal(queue[0].kind, "photo");
});

test("the parked photo does reach the server on the next drain", async () => {
  await sync.queuedPhoto("job-1", "data:image/jpeg;base64,AAAA");
  await sync.flush();

  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].kind, "photo");
  assert.equal(queue.length, 0, "and leaves the queue once it lands");
});

/* ---------------- identity across a lost response ---------------- */

test("a live write carries a client_id, so the server can recognise a repeat", async () => {
  await sync.queuedNewCall({ name: "Akash", problem: "NOT WORKING" });
  assert.equal(apiCalls.length, 1);
  assert.ok(apiCalls[0].cid, "the first attempt must already be identified");
});

test("a write parked after a lost response keeps the id it was attempted under", async () => {
  // The dangerous case: this reached the server and the answer never came back.
  nextResult = () => { throw networkFailure(); };
  await sync.queuedNewCall({ name: "Akash", problem: "NOT WORKING" });

  const attemptedId = apiCalls[0].cid;
  assert.equal(queue.length, 1);
  assert.equal(queue[0].clientId, attemptedId,
    "a fresh id would present the replay as a brand-new call — a second ticket and a second WhatsApp");
});

test("the replay reaches the server under that same id", async () => {
  nextResult = () => { throw networkFailure(); };
  await sync.queuedNewCall({ name: "Akash", problem: "NOT WORKING" });
  const attemptedId = apiCalls[0].cid;

  nextResult = () => ({ ok: true });
  await sync.flush();

  assert.equal(apiCalls.length, 2);
  assert.equal(apiCalls[1].cid, attemptedId);
});

test("every queued kind carries an id — step, arrival, cancel, new call", async () => {
  await offline(async () => {
    await sync.queuedStep("job-1", "diagnose", {});
    await sync.queuedVerifyArrival("job-1", "1234");
    await sync.queuedCancel("job-1", "Nobody home");
    await sync.queuedNewCall({ name: "Akash", problem: "X" });
  });

  assert.equal(queue.length, 4);
  for (const item of queue) assert.ok(item.clientId, `${item.kind} was parked with no id`);
});

/* ---------------- what the drain does ---------------- */

test("offline, the write is parked and a drain leaves it alone", async () => {
  await offline(async () => {
    await sync.queuedStep("job-1", "arrive", {});
    await sync.flush();          // flush() bails on navigator.onLine
    assert.equal(queue.length, 1, "the step stays parked");
    assert.equal(apiCalls.length, 1, "only the live attempt was made, and it failed");
  });
});

test("the queue replays oldest first, so a job's steps land in the order they happened", async () => {
  await offline(async () => {
    await sync.queuedStep("job-1", "arrive", {});
    await sync.queuedStep("job-1", "diagnose", {});
    await sync.queuedStep("job-1", "payment", {});
  });
  apiCalls.length = 0;
  await sync.flush();

  assert.deepEqual(apiCalls.map((c) => c.action), ["arrive", "diagnose", "payment"]);
});

test("a server blip keeps the item and stops the drain, so order survives", async () => {
  await offline(async () => {
    await sync.queuedStep("job-1", "arrive", {});
    await sync.queuedStep("job-1", "payment", {});
  });
  apiCalls.length = 0;
  nextResult = () => { throw serverError(503); };
  await sync.flush();

  assert.equal(queue.length, 2, "a 5xx must not discard a recorded payment");
  assert.equal(apiCalls.length, 1, "and must not let the next item overtake it");
  assert.equal(queue[0].tries, 1);
});

test("a write the server refuses outright is dropped, not left blocking the queue", async () => {
  await offline(async () => {
    await sync.queuedStep("job-1", "arrive", {});
    await sync.queuedStep("job-1", "payment", {});
  });
  apiCalls.length = 0;
  let n = 0;
  nextResult = () => { if (++n === 1) throw serverError(400); return { ok: true }; };
  await sync.flush();

  assert.equal(queue.length, 0, "the bad one goes, the good one still gets through");
  assert.equal(apiCalls.length, 2);
});

test("the UI is handed the updated job before the item leaves the queue", async () => {
  // The other order leaves a frame where a just-uploaded photo is in neither
  // list, and the work screen's "photo required" gate blinks off mid-tap.
  const seen = [];
  sync.setJobSink((job) => seen.push({ job, queueLen: queue.length }));

  await sync.queuedPhoto("job-1", "data:image/jpeg;base64,AAAA");
  nextResult = () => ({ ok: true, job: { id: "job-1" } });
  await sync.flush();

  assert.equal(seen.length, 1);
  assert.equal(seen[0].queueLen, 1, "the photo was still in the queue when the UI was told");
  assert.equal(queue.length, 0);
  sync.setJobSink(null);
});

test("a real server error on a live write surfaces to the technician", async () => {
  // Only lost connections are swallowed into the queue. A 400 means the write
  // was understood and refused, and the screen must say so.
  nextResult = () => { throw serverError(400); };
  await assert.rejects(() => sync.queuedCancel("job-1", ""), /400/);
  assert.equal(queue.length, 0);
});

test("an uploaded photo is kept on the phone under the URL it landed at", async () => {
  // Otherwise the thumbnail is fetched back down over the same weak signal it
  // was just uploaded through — and with no signal it renders blank.
  const image = "data:image/jpeg;base64,AAAA";
  await sync.queuedPhoto("job-1", image);
  nextResult = () => ({ ok: true, job: { id: "job-1", work: { tech_photos: ["https://cdn/old.jpg", "https://cdn/new.jpg"] } } });
  await sync.flush();

  assert.deepEqual(remembered, [{ url: "https://cdn/new.jpg", dataUrl: image }],
    "the photo just uploaded is the LAST one on the job, not the first");
});
