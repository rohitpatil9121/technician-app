import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { CALL_TYPES, SVC_PRESETS, SVC_STEP, SVC_MAX, INSTALLATION_CHARGE, chargeTypes } from "../data/charges.js";
import { rupee, rupeeAmt } from "../lib/format.js";
import { mediaUrl } from "../lib/api.js";
import { callPhone, openMaps, openWhatsApp } from "../lib/contact.js";
import { takePhoto } from "../lib/camera.js";
import { getPositionOnce } from "../lib/location.js";
import {
  loadJobDraft, saveJobDraft, clearJobDraft, markPhotoStart, clearPhotoMark, pendingPhotoKind, pinRoute, acknowledgeJobResume, applyJobDraft, leaveJobScreen,
} from "../lib/jobDraft.js";
import { App as CapApp } from "@capacitor/app";
import { takePendingPhoto, onPendingPhoto } from "../lib/photoRestore.js";
import { queuedPhoto, queuedCancel, onOutboxChange } from "../lib/sync.js";
import { pendingPhotos } from "../lib/outbox.js";
import UpiQr from "../components/UpiQr.jsx";
import {
  Icon, IconChip, Card, FLabel, PrimaryButton, GhostButton, MDialog, MDialogBtn, MSheet, PlusMinus,
  input, cx, Skeleton, RupeeCount, JobPhoto,
} from "../components/ui.jsx";
import { stepIndexForStatus, STEPS } from "../lib/workflow.js";

/* Same options the dashboard offers (frontend/src/components/CancelModal.jsx).
   Kept in step by hand — the two apps are separate builds — so that cancellation
   reasons stay comparable across the field and the office. */
const CANCEL_REASONS = [
  "Customer no longer needs the service",
  "Issue resolved on its own",
  "Customer found another service provider",
  "Duplicate request",
  "Unable to reach the customer",
  "Out of service area",
  "Other",
];


/* A billed part is { …catalog item, price, qty }: `price` is the per-piece rate
   the technician may edit, `qty` how many went in. Jobs billed before quantities
   existed have no `qty` field, so every read defaults to 1 — old bills keep
   totalling exactly as they did. */
const QTY_MAX = 99;
const partQty = (p) => Math.max(1, Math.min(QTY_MAX, Number(p?.qty) || 1));
const partLineTotal = (p) => Number(p?.price || 0) * partQty(p);
/* Summary rows read as "RO Membrane × 2" only when there really is more than one
   — a "× 1" on every line is noise the technician has to read past. */
const partLabel = (p) => (partQty(p) > 1 ? `${p.name} × ${partQty(p)}` : p.name);

/* Sub-line under a part's name on the bill: "BRAND · SKU". Both halves are
   optional — sku is nullable on stock_items (and unset on every row today), and
   brand falls back to the literal "other", which is noise rather than
   information. Returns "" when there is nothing worth showing so the caller can
   drop the line entirely instead of rendering a stray separator. */
const partMeta = (p) => {
  const brand = String(p?.brand || "").trim();
  const sku = String(p?.sku || "").trim();
  return [brand && brand.toLowerCase() !== "other" ? brand : "", sku].filter(Boolean).join(" · ");
};

/* A part's price has to sit between the floor the office set (base_cost) and its
   ceiling (MRP, the catalog price), both stamped onto the part when it was added.
   Returns the limit that was breached, or "" when the price is fine.

   This used to be silent: the typed number was clamped, so a technician who keyed
   ₹25 against a ₹20 MRP simply watched it turn into ₹20 with no reason given. The
   office noticed the warning earlier builds showed had gone. Clamping also hid
   the floor the same way. The server rejects both directions when the estimate is
   sent, so the number now stands as typed and the breach is shown in red instead
   of being corrected behind the technician's back. */
const priceLimit = (p) => {
  const v = Number(p?.price || 0);
  const min = Number(p?.minPrice || 0);
  const max = Number(p?.mrp || 0);
  if (min > 0 && v < min) return `Min ${rupeeAmt(min)}`;
  if (max > 0 && v > max) return `MRP ${rupeeAmt(max)}`;
  return "";
};

/* Simple bill row. */
const Row = ({ l, r, muted }) => (
  <div className={cx("flex items-center justify-between py-1 text-[15px]", muted ? "text-muted" : "text-muted")}>
    <span>{l}</span><span className="tnum font-semibold text-strong">{r}</span>
  </div>
);

/* Mockup .htitle/.hsub screen heading. */
const Heading = ({ title, sub }) => (
  <div className="pb-1 pt-2">
    <h2 className="text-[26px] font-extrabold tracking-tight text-strong">{title}</h2>
    {sub && <p className="mt-0.5 text-[15px] leading-snug text-muted">{sub}</p>}
  </div>
);

/* Mockup .milestone — 5 bubbles with joining bars. `doneUpTo` is how far the job
   has actually got; `current` is the screen being shown, which is earlier than
   that while the technician is stepping back through finished milestones. */
function JobSteps({ doneUpTo, current }) {
  return (
    <div className="border-b border-line bg-surface px-3 pb-3 pt-3.5">
      <div className="flex items-start">
        {STEPS.map((s, i) => {
          const cur = i === current;
          const done = i < current;
          // Stepped back: milestones between here and where the job really is.
          // Tinted rather than ticked — reached, but not finished business.
          const reached = i > current && i <= doneUpTo;
          const Ic = Icon[s.icon] || Icon.check;
          return (
            <div key={s.key} className="relative flex flex-1 flex-col items-center gap-1.5">
              {i > 0 && (
                <span className={cx("absolute left-[-50%] top-[15px] z-0 h-[3px] w-full transition-colors duration-300", done || cur || reached ? "bg-ok" : "bg-line")} aria-hidden="true" />
              )}
              <span
                aria-current={cur ? "step" : undefined}
                className={cx(
                  // 300ms to sit with the 280ms content slide — a 150ms default
                  // finished well before the screen did and read as two events.
                  "z-10 grid h-8 w-8 place-items-center rounded-full transition-colors duration-300",
                  done && "bg-ok text-white",
                  cur && "bg-brand text-white ring-4 ring-brand-tint",
                  reached && "bg-brand-tint text-brand-dark",
                  !done && !cur && !reached && "bg-tonal text-subtle"
                )}
              >
                {done ? <Icon.check width={16} height={16} strokeWidth={2.5} /> : <Ic width={15} height={15} />}
              </span>
              <span className={cx("text-[11px] font-semibold", done ? "text-ok-fg" : cur ? "font-bold text-brand" : reached ? "text-brand-dark" : "text-subtle")}>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { getJob } = useJobs();
  const job = getJob(id);
  if (!job) {
    return (
      <div className="safe-x flex min-h-screen flex-col bg-sunken px-4 pt-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-28" />
        <Skeleton className="mt-4 h-32 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
      </div>
    );
  }
  return <JobDetailInner key={job.id} job={job} />;
}

function JobDetailInner({ job }) {
  const nav = useNavigate();
  const { updateJob, parts: partsCatalog } = useJobs();
  const w = job.work || {};
  const draft = loadJobDraft(job.id);
  const st = job.status;

  /* ------- editable state (seeded from saved work + draft after reload) ------- */
  const [callType, setCallType] = useState(draft?.callType ?? w.call_type ?? (job.visitCharge === 0 ? "warranty" : "service"));
  const [serviceCharge, setServiceCharge] = useState(
    Number(draft?.serviceCharge ?? w.service_charge ?? (job.visitCharge === 0 ? 0 : 250))
  );
  const [parts, setParts] = useState(draft?.parts ?? w.parts ?? []);
  const [modelName, setModelName] = useState(
    draft?.modelName ?? w.model_name ?? (job.model && job.model !== "—" ? job.model : "")
  );
  const [partSearch, setPartSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [queuedPhotos, setQueuedPhotos] = useState([]);
  // A shot the technician has taken but not yet confirmed. Nothing is queued
  // or uploaded until he taps "Use photo" — a wrong pick from the gallery, or a
  // blurry frame, is simply discarded from here (owner, 15 Sep 2026).
  const [shot, setShot] = useState(null); // { dataUrl, kind: "job" | "proof" }
  /* payment */
  const [payScreen, setPayScreen] = useState(null); // null | cash | upi | split
  // Which milestone the technician is LOOKING at, when that is not the one the
  // job is actually on (null = the live screen). Back walks this index down so
  // every screen already passed — Payment → Work → Bill → Details — can be
  // reopened, which is how the earlier "Edit Bill" button worked, generalised.
  //
  // Revisiting never rewinds job.status. The backend step machine only moves
  // forward (sync.js drops steps the job is already past), so a rewind would
  // either be rejected or corrupt the office's audit trail. Saving from a
  // revisited screen re-sends the CURRENT step with the corrected work instead.
  const [revisit, setRevisit] = useState(null);
  const [stepDir, setStepDir] = useState("fwd"); // slide direction for the step change
  const [cashPart, setCashPart] = useState(Number(draft?.cashPart ?? 0));
  const [upiDone, setUpiDone] = useState(false);
  const [cashDone, setCashDone] = useState(false);
  const [upiProofUrl, setUpiProofUrl] = useState(null);
  /* overlays: one at a time, mockup-style */
  const [ov, setOv] = useState(null); // reached | cancel | picker | cashConfirm | upiConfirm | splitCash | splitUpi | splitConfirm | preview:<url>
  // Cancellation, offered alongside "Reached". Same reason list the dashboard
  // shows (frontend/src/components/CancelModal.jsx) so reports stay consistent.
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelErr, setCancelErr] = useState("");
  const [celebrate, setCelebrate] = useState(false);

  const draftRef = useRef({});
  draftRef.current = { callType, serviceCharge, parts, modelName, cashPart };

  useEffect(() => {
    pinRoute(`/job/${job.id}`);
    applyJobDraft(loadJobDraft(job.id), {
      setCallType, setServiceCharge, setParts, setModelName, setCashPart,
    });
    acknowledgeJobResume();
  }, [job.id]);

  // Save draft when app backgrounds (camera opens — WebView may reload after).
  useEffect(() => {
    const flush = () => saveJobDraft(job.id, draftRef.current);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    let sub;
    CapApp.addListener("appStateChange", ({ isActive }) => { if (!isActive) flush(); })
      .then((h) => { sub = h; })
      .catch(() => {});
    return () => { document.removeEventListener("visibilitychange", onHide); sub?.remove?.(); };
  }, [job.id]);

  useEffect(() => {
    const t = setTimeout(() => saveJobDraft(job.id, draftRef.current), 150);
    return () => clearTimeout(t);
  }, [job.id, callType, serviceCharge, parts, modelName, cashPart]);

  // Android can destroy the WebView while the camera is open — replay the shot.
  // It is offered for confirmation exactly like a shot taken in-session, on the
  // tile (job / payment proof) that opened the camera.
  useEffect(() => {
    let cancelled = false;
    const offer = (dataUrl) => {
      if (cancelled || !dataUrl) return;
      const kind = pendingPhotoKind();
      clearPhotoMark();
      setShot({ dataUrl, kind });
    };
    offer(takePendingPhoto());
    const off = onPendingPhoto(offer);
    return () => { cancelled = true; off?.(); };
  }, [job.id]);

  const refreshQueuedPhotos = useCallback(
    () => pendingPhotos(job.id).then(setQueuedPhotos).catch(() => {}),
    [job.id]
  );
  useEffect(() => {
    refreshQueuedPhotos();
    return onOutboxChange(refreshQueuedPhotos);
  }, [refreshQueuedPhotos]);

  /* Returns the in-flight write so steps that must not overlap can await it. */
  const advance = useCallback((status, work, action) => {
    setStepDir("fwd");
    const p = updateJob(job.id, { status, work, ...(action ? { action } : {}) });
    if (status !== st) clearJobDraft(job.id);
    return p;
  }, [job.id, st, updateJob]);

  /* One milestone per tap, whatever the network does.

     updateJob patches the job optimistically, so the screen swaps under the
     finger before the write lands — and each milestone's primary button sits in
     the same place as the next one's. An ordinary impatient double tap
     therefore walked TWO milestones: "Start Work" carried the technician from
     Bill past Work and into Payment, recording work-done for a repair nobody
     had started. `busy` alone could not close this, because the button the
     second tap actually hits belongs to the screen that has already replaced
     it, and offline writes resolve fast enough to clear `busy` in between.
     A timestamp is what survives both — it outlives the render. */
  const stepLock = useRef(0);
  const STEP_GAP_MS = 700;
  const advanceOnce = useCallback((status, work, action) => {
    const now = Date.now();
    if (now - stepLock.current < STEP_GAP_MS) return Promise.resolve();
    stepLock.current = now;
    setBusy(true);
    return Promise.resolve(advance(status, work, action)).finally(() => setBusy(false));
  }, [advance]);

  /* ------------------------------- derived ------------------------------- */
  // liveStep = where the job really is; viewStep = which screen is on show.
  // Once PAID the invoice carries a permanent number, so nothing behind it may
  // be reopened — back leaves the job instead of stepping into the bill. CLOSED
  // is excluded too: it renders its own read-only screen further down, which
  // ignores `revisit`, so stepping into it would leave hardware back looking
  // dead until it had counted all the way down to the first milestone.
  const liveStep = stepIndexForStatus(st);
  const canRevisit = st !== "PAID" && st !== "CLOSED";
  const viewStep = (canRevisit ? revisit : null) ?? liveStep;
  const revisiting = viewStep < liveStep;
  const editBill = revisiting && viewStep === 2;
  // Which way the milestone content should slide in. Set by whoever moves the
  // step rather than derived from a previous-value ref, so StrictMode's double
  // render can't flip it and restart the animation mid-flight.
  // next === null means "return to the live screen", which is always forward.
  const goStep = (next) => { setStepDir(next != null && next < viewStep ? "back" : "fwd"); setRevisit(next); };
  // The payment method → cash/UPI/split screens are the same kind of move, so
  // they slide the same way: into a method is forward, back out of it is back.
  const goPay = (screen) => { setStepDir(screen ? "fwd" : "back"); setPayScreen(screen); };
  /* Back walks ONE milestone at a time and only leaves the job from the first
     screen. It used to stop peeling at Details (`viewStep > 1`), so back from
     there dropped straight out of the job — the technician lost the whole screen
     stack instead of stepping to Reach, which is not what back did anywhere else
     in the flow. Reach itself is the floor: from there back means "leave". */
  const stepBack = () => (viewStep > 0 && canRevisit ? goStep(viewStep - 1) : goBack());
  const stepForward = () => goStep(viewStep + 1 >= liveStep ? null : viewStep + 1);

  const partsTotal = parts.reduce((s, p) => s + partLineTotal(p), 0);
  const partsCount = parts.reduce((s, p) => s + partQty(p), 0);
  /* Any part priced outside its limits blocks the bill. The server refuses such
     an estimate with a 400, so letting the tap through would surface an opaque
     server error at the worst moment — in front of the customer. */
  const badPrice = parts.some((p) => priceLimit(p));
  const estTotal = serviceCharge + partsTotal;
  const billTotal = Number(w.total ?? estTotal);
  const typeOf = CALL_TYPES.find((c) => c.id === callType) || CALL_TYPES[0];
  const svcLabel = (v) => (v === 0 ? "Free" : rupeeAmt(v));

  /* Picker rows are a toggle, not a counter: tap once to add the part, tap the
     same row again to take it off the bill. Repeated taps used to stack
     duplicates, which technicians hit by accident far more often than they
     genuinely needed two of the same part. */
  const togglePart = (p) =>
    setParts((prev) => (
      prev.some((x) => x.id === p.id)
        ? prev.filter((x) => x.id !== p.id)
        : [...prev, { ...p, qty: 1, mrp: Number(p.price || 0), minPrice: Number(p.minPrice || 0) }]
    ));
  // Kept as typed (only nonsense is rejected) so priceLimit can flag it in red —
  // see the note on priceLimit for why this no longer clamps to MRP.
  const setPartPrice = (i, n) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, price: Math.max(0, Math.floor(Number(n) || 0)) } : p)));
  /* `price` is the per-piece rate; the line the customer pays is price × qty.
     Both writers derive the new quantity inside the updater so two quick taps on
     + can't both read the same stale row and lose one of the increments. */
  const clampQty = (n) => Math.max(1, Math.min(QTY_MAX, Math.floor(Number(n) || 1)));
  const setPartQtyAt = (i, n) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, qty: clampQty(n) } : p)));
  const bumpPartQty = (i, d) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, qty: clampQty(partQty(p) + d) } : p)));
  const partQuery = partSearch.trim().toLowerCase();
  const filteredParts = partQuery
    ? partsCatalog.filter((p) => `${p.name} ${p.brand}`.toLowerCase().includes(partQuery))
    : partsCatalog;

  /* Open the camera for a job photo or a payment proof. The result is NOT
     queued here — it lands in `shot` and waits for the technician to confirm. */
  const capture = async (kind) => {
    saveJobDraft(job.id, draftRef.current);
    markPhotoStart(`/job/${job.id}`, kind);
    setPhotoBusy(true);
    try {
      const dataUrl = await takePhoto();
      if (dataUrl) setShot({ dataUrl, kind });
    } catch {
      // Cancelled in the camera, or no camera (browser) — nothing to confirm.
    } finally {
      clearPhotoMark();
      setPhotoBusy(false);
    }
  };
  const takeJobPhoto = () => capture("job");
  const takeProofPhoto = () => capture("proof");

  /* "Use photo": park it in the outbox. The thumbnail comes back through the
     outbox subscription above and sync.js uploads it in the background. */
  const keepShot = async () => {
    if (!shot) return;
    const { dataUrl, kind } = shot;
    setShot(null);
    setPhotoBusy(true);
    try {
      await queuedPhoto(job.id, dataUrl);
      // Show the shot the technician just took, not the server's copy of it —
      // it is identical, already on the phone, and available now.
      if (kind === "proof") setUpiProofUrl(dataUrl);
      await refreshQueuedPhotos();
    } catch (e) {
      console.error("photo queue:", e.message);
    } finally {
      setPhotoBusy(false);
    }
  };
  /* "Back": drop the shot — nothing has been saved anywhere. */
  const discardShot = () => setShot(null);
  /* "Retake": drop it and open the camera again for the same tile. */
  const retakeShot = () => { const kind = shot?.kind || "job"; setShot(null); capture(kind); };

  const uploadedPhotos = w.tech_photos || [];
  const techPhotos = [...uploadedPhotos, ...queuedPhotos];

  /* Payment finish: record PAID then CLOSE in one go (mockup has no separate
     close tap). Chained awaits — the outbox preserves order offline. */
  const finishPayment = async (payments, mode, split) => {
    setOv(null); setBusy(true);
    // Land on the celebration first, then write. See the note above the
    // `if (celebrate)` screen: the two writes below flip the job's status
    // optimistically, so anything rendered between them is a screen the
    // technician never asked for and can act on by mistake.
    setCelebrate(true);
    await advance("PAID", { payments, total: billTotal, mode, split });
    await advance("CLOSED", { nextService: "6 months" });
    setBusy(false);
  };
  const upiRemainder = Math.max(0, billTotal - Math.min(cashPart, billTotal));

  /* Bill → Payment in one tap, now that Work is not a screen any more.
     Both of the writes the old two-tap route made still happen, in the same
     order: "estimate" (VERIFIED) records the agreed bill and sends it to the
     customer, then "workdone" stamps work_done_at and sends the amount-due
     message. Dropping either would quietly change what the office sees and what
     the customer is told, so only the screen went away, not the trail.
     Chained awaits — the outbox preserves order offline. Guarded by the same
     one-tap-per-milestone lock as every other step. */
  const collectPayment = async () => {
    const now = Date.now();
    if (now - stepLock.current < STEP_GAP_MS) return;
    stepLock.current = now;
    setBusy(true);
    await advance("VERIFIED", {
      call_type: callType, charge: callType, service_charge: serviceCharge,
      parts, total: estTotal, model_name: modelName.trim(), work_started: true,
    }, "estimate");
    /* Where the bill was written, for the office. Read now rather than taken
       from the live tracker, which is off whenever the app is backgrounded.
       Awaited on purpose — a fix takes a moment and the bill is worth waiting
       for — but it can never block: getPositionOnce resolves null on a denied
       permission or in a basement, and the bill saves without it. */
    await advance("WORK_DONE", { total: estTotal, bill_location: await getPositionOnce() });
    setBusy(false);
  };

  /* "I Reached": the arrival OTP was removed with the M3 redesign (client call)
     — a confirmation dialog starts the job. enroute must LAND before arrive. */
  const confirmReached = async () => {
    setOv(null); setBusy(true);
    if (st === "NEW" || st === "ACCEPTED") await advance("ON_THE_WAY");
    await advance("ARRIVED");
    setBusy(false);
  };

  /* Cancelling from the field: customer isn't home, address is wrong, they
     changed their mind at the door. Goes through the same backend path as the
     dashboard's cancel, so the customer gets the usual cancellation message
     with the reason. Not queued through the offline outbox — cancelling is a
     decision the technician should see confirmed before walking away. */
  const confirmCancel = async () => {
    const why = cancelReason === "Other" ? cancelNote.trim() : cancelReason;
    if (!why) { setCancelErr("Please choose a reason."); return; }
    setBusy(true); setCancelErr("");
    try {
      await queuedCancel(job.id, why);
      setOv(null);
      leaveJobScreen();
      nav("/home");
    } catch (e) {
      setCancelErr(e?.message || "Could not cancel. Please try again.");
    } finally { setBusy(false); }
  };

  /* Bill saved-work lines for finished/late screens. */
  const savedCharge = w.service_charge != null
    ? { label: "Service charge", amount: Number(w.service_charge) }
    : { label: chargeTypes.find((c) => c.id === w.charge)?.label || "Service charge", amount: chargeTypes.find((c) => c.id === w.charge)?.amount ?? 0 };
  const billParts = w.parts ?? parts;
  const billLines = (
    <>
      <Row l={savedCharge.label} r={savedCharge.amount === 0 ? "Free" : rupeeAmt(savedCharge.amount)} muted />
      {billParts.map((p, i) => <Row key={i} l={partLabel(p)} r={rupeeAmt(partLineTotal(p))} muted />)}
    </>
  );

  const goBack = () => { leaveJobScreen(); nav("/home"); };

  /* Cancel on a revisited screen means DISCARD, so the edits have to be thrown
     away — not just navigated away from. They used to survive: the fields are
     component state, so a technician who opened Edit Bill, changed a rate, then
     thought better of it and pressed Cancel still had the abandoned number
     sitting in `parts`. Nothing on the payment screen showed it (that reads the
     saved work), so it was invisible right up until the next Edit Bill — or
     until the draft carrying it was restored after a reload. Re-seed from the
     saved work, exactly as a fresh mount would. */
  const discardRevisit = () => {
    setCallType(w.call_type ?? (job.visitCharge === 0 ? "warranty" : "service"));
    setServiceCharge(Number(w.service_charge ?? (job.visitCharge === 0 ? 0 : 250)));
    setParts(w.parts ?? []);
    setModelName(w.model_name ?? (job.model && job.model !== "—" ? job.model : ""));
    stepForward();
  };

  /* Persist a correction made on a revisited screen. The job stays exactly where
     it is — this re-sends the step it is ALREADY on, carrying the whole work
     payload so nothing the server holds gets blanked by a partial patch.
     VERIFIED was reached by the "estimate" action rather than its own, so its
     re-send has to name that action explicitly. */
  const saveRevisit = async () => {
    const now = Date.now();
    if (now - stepLock.current < STEP_GAP_MS) return; // sends customer WhatsApp — once per tap
    stepLock.current = now;
    setBusy(true);
    const work = {
      call_type: callType, charge: callType, service_charge: serviceCharge,
      parts, total: estTotal, model_name: modelName.trim(),
    };
    if (editBill) {
      /* A corrected bill has to reach the customer exactly like a new one does —
         the itemised estimate, then the amount due — because that is the whole
         point of letting the bill be edited after it was shown.

         Re-sending only the status the job happens to sit on did not do that.
         Once "Collect Payment" started landing on WORK_DONE (it used to stop at
         VERIFIED, with the Work screen in between), every edit re-sent just the
         amount and never the corrected line items, so a customer who had been
         quoted the wrong parts was never told which parts changed.

         Both writes carry the same corrected work, so replaying them is safe:
         status ends where it already was and the totals are recomputed. */
      await advance("VERIFIED", { ...work, work_started: true }, "estimate");
      await advance("WORK_DONE", { total: estTotal, bill_location: await getPositionOnce() });
    } else {
      await advance(st, work, st === "VERIFIED" ? "estimate" : undefined);
    }
    setBusy(false);
    goStep(null);
  };

  /* Android hardware back. Milestones and sub-screens here are component state
     rather than history entries, so without this the system back drops straight
     out of the job — from the payment screen that felt like the app had thrown
     the bill away. Peel one layer at a time, same order as the header back
     arrow: overlay, then payment sub-screen, then one milestone back. A ref
     keeps the listener registered once instead of re-subscribing on every
     state change. */
  const backRef = useRef(() => {});
  backRef.current = () => {
    // A finished job has exactly one way out: the jobs list. This is checked
    // before `busy` because the celebration now shows while the PAID/CLOSED
    // writes are still in flight, and back must not be dead on a screen whose
    // only other control is "Back to Jobs". Without this branch the completion
    // screen ate the first back press — finishPayment never clears payScreen,
    // so `payScreen` was still "cash" and back ran goPay(null), which changes
    // nothing there. The second press then tried to step backwards *into* a
    // finished job.
    if (celebrate || st === "CLOSED") return goBack();
    if (busy) return;
    if (shot) discardShot();
    else if (ov) setOv(null);
    else if (payScreen) goPay(null);
    else stepBack();
  };
  useEffect(() => {
    let sub, gone = false;
    CapApp.addListener("backButton", () => backRef.current())
      .then((h) => { sub = h; if (gone) h.remove?.(); })
      .catch(() => {});
    return () => { gone = true; sub?.remove?.(); };
  }, []);

  /* --------------------------- payment finished ---------------------------
     The celebration outranks every other screen, and is shown from the moment
     the technician confirms the money — not when the two writes it triggers
     land. updateJob patches the job optimistically, so waiting for them made
     two screens flash past on the way here: "Payment recorded · Close the job"
     while the PAID write was in flight, then the read-only closed-job record
     while CLOSED was. On a slow connection those sat there long enough to tap.
     Both writes go through the offline outbox and are replayed if they fail, so
     there is nothing left for the technician to do either way. */
  /* ONE finished-job screen, for both routes into it: straight off the payment
     confirmation, and reopening the job later from Done. The two used to differ
     — payment landed on a bare centred summary while Done showed the full record
     — which meant the technician saw a thinner version of the job at the only
     moment they might still want to check it, and had to leave and come back for
     the rest. `celebrate` now only decides the flourish and the way out. */
  if (celebrate || st === "CLOSED") {
    // Read the call type off the SAVED work, not the editable state: a job
    // finished by an older build may carry only the legacy `charge` id.
    const doneType = CALL_TYPES.find((c) => c.id === (w.call_type ?? w.charge)) || typeOf;
    return (
      <div className="safe-x safe-top mx-auto flex h-screen w-full max-w-[440px] flex-col overflow-hidden bg-sunken">
        <JobHead job={job} onBack={goBack} label="Done" />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <Card className="mt-2 !py-6 text-center">
            {/* One centred header for both routes in. IconChip is display:grid, so
                it is block-level and the card's text-center could not pull it in —
                reopening from Done showed the tick hard against the left edge
                under centred text. `celebrate` now only adds the entry animation,
                which is the only thing that should differ between the two. */}
            <div className={cx(
              "mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-ok text-white",
              celebrate && "animate-scale-in"
            )}>
              <Icon.check width={40} height={40} strokeWidth={2.5} />
            </div>
            <div className="mt-2.5 text-[22px] font-extrabold tracking-tight text-strong">Job Complete</div>
            <div className="mt-0.5 text-[15px] leading-snug text-muted">{job.name}{job.area ? ` · ${job.area}` : ""}</div>
            <div className="mt-0.5 text-[13px] text-subtle">{job.code} · {job.when}</div>
          </Card>

          <SecH>Bill</SecH>
          <Card>
            <Row l="Call type" r={doneType.label} muted />
            {billLines}
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
              <span className="text-[16px] font-bold text-strong">Total paid</span>
              <span className="tnum text-[28px] font-extrabold tracking-tight text-strong">{rupeeAmt(w.total ?? billTotal)}</span>
            </div>
          </Card>

          <SecH>Payment</SecH>
          <Card>
            <Row l="Mode" r={w.mode || "—"} muted />
            {/* On a split, "Cash + UPI" alone never said how much went each way —
                the technician had to remember. Only worth showing when the money
                actually came in more than one part. */}
            {Array.isArray(w.payments) && w.payments.length > 1 && w.payments.map((p, i) => (
              <div key={`${p.method}-${i}`} className="flex items-center justify-between py-1 pl-3 text-[14px] text-subtle">
                <span>{p.method}</span>
                <span className="tnum font-semibold text-muted">{rupeeAmt(p.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-1 text-[15px] text-muted">
              <span>Status</span><span className="font-bold text-ok-fg">Paid ✓</span>
            </div>
            <Row l="Next service" r={w.nextService || "6 months"} muted />
          </Card>

          {uploadedPhotos.length > 0 && (
            <>
              <SecH>Photos & proof</SecH>
              <Card>
                <div className="flex flex-wrap gap-2">
                  {uploadedPhotos.map((url) => (
                    <button key={url} type="button" aria-label="View photo" onClick={() => setOv("preview:" + url)} className="shrink-0">
                      <JobPhoto src={url} alt="Job photo" className="h-20 w-20 rounded-2xl object-cover" />
                    </button>
                  ))}
                </div>
              </Card>
            </>
          )}

          <SecH>Rating</SecH>
          <Card>
            {job.rating != null ? (
              <div className="flex items-center justify-between py-1 text-[15px] text-muted">
                <span>Customer rating</span>
                <span className="text-sm font-bold text-strong">
                  {job.rating >= 5 ? "Best" : job.rating >= 3 ? "Good" : "Poor"}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-2xl border border-wa/40 bg-wa-tint p-3 text-[14.5px] font-medium text-wa-dark">
                <Icon.whatsapp width={18} height={18} className="shrink-0 text-wa" />
                {/* One flex item, not three: the bare text around <b> was being
                    split into anonymous flex items, so gap-2.5 pushed "Customer
                    will", "rate you" and "on WhatsApp" apart across the row. */}
                <span>Customer will <b>rate you</b> on WhatsApp</span>
              </div>
            )}
          </Card>

          {!celebrate && (
            <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-warn-tint p-3.5 text-[14.5px] font-medium text-warn-fg">
              <Icon.checkCircle width={19} height={19} className="shrink-0" /> This job is finished — read-only record.
            </div>
          )}
        </main>
        {/* Only the payment route gets a button out: reopening from Done arrived
            through the header back arrow, which is still where it leads. */}
        {celebrate && (
          <div className="safe-bottom px-4 pb-4 pt-2">
            <PrimaryButton onClick={goBack}><Icon.home width={19} height={19} /> Back to Jobs</PrimaryButton>
          </div>
        )}
        {ov?.startsWith("preview:") && <ImagePreview src={ov.slice(8)} onClose={() => setOv(null)} />}
      </div>
    );
  }

  /* --------------------------- active job screens ---------------------------
     One branch per milestone, chosen by viewStep — so the same screens serve
     both the live job and a technician who has stepped back into one. */
  let body = null, footer = null;

  if (viewStep === 0) {
    body = (
      <>
        <Card className="mt-2">
          <FLabel icon={Icon.person}>Contact Customer</FLabel>
          <div className="mb-3 text-[17px] font-bold text-strong">{job.name}</div>
          <div className="flex gap-2.5">
            <GhostButton className="flex-1" onClick={() => callPhone(job.phone)} disabled={!job.phone}>
              <Icon.phone width={19} height={19} /> Call
            </GhostButton>
            <button type="button" onClick={() => openWhatsApp(job.phone)} disabled={!job.phone}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border border-wa/40 bg-white text-[15px] font-bold text-wa-dark disabled:opacity-40">
              <Icon.whatsapp width={19} height={19} className="text-wa" /> WhatsApp
            </button>
          </div>
        </Card>
        <Card className="mt-3">
          <FLabel icon={Icon.pin}>Address</FLabel>
          <div className="text-[15px] leading-relaxed text-muted">{job.address || "—"}</div>
          <GhostButton className="mt-3 w-full" onClick={() => openMaps(job.address)} disabled={!job.address}>
            <Icon.pin width={18} height={18} /> Open in Map
          </GhostButton>
        </Card>
        <Card className="mt-3">
          <FLabel icon={Icon.alert}>Issue</FLabel>
          <div className="text-[17px] font-semibold tracking-tight text-strong">{job.issue || "—"}</div>
        </Card>
        <Card className="mt-3">
          <FLabel icon={Icon.drop}>Purifier Details</FLabel>
          <Row l="Model" r={job.model || "—"} muted />
          {job.customerPhotos?.length > 0 && (
            <>
              <div className="mb-2 mt-3 text-xs font-bold uppercase tracking-wide text-subtle">Customer Photos</div>
              {/* Tappable, exactly like the technician's own photos below — the
                  customer's picture of the fault is often the one worth zooming
                  into, and a bare <img> gave no way to open it. */}
              <div className="flex gap-2 overflow-x-auto">
                {job.customerPhotos.map((cid) => {
                  const url = mediaUrl(cid);
                  return (
                    <button key={cid} type="button" aria-label="View customer photo"
                      onClick={() => setOv("preview:" + url)} className="shrink-0">
                      <img src={url} alt="Customer photo"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                        className="h-[78px] w-[78px] rounded-2xl object-cover" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </>
    );
    /* Stepping back into Reach on an arrived job must not offer "Reached" again —
       the way out is forward, the same as every other revisited milestone. */
    footer = revisiting ? (
      <PrimaryButton onClick={stepForward}>
        Back to {STEPS[Math.min(liveStep, STEPS.length - 1)].label} <Icon.chevron width={19} height={19} />
      </PrimaryButton>
    ) : (
      <div className="flex w-full flex-col gap-2">
        <PrimaryButton className="!bg-ok" disabled={busy} loading={busy} onClick={() => setOv("reached")}>
          <Icon.checkCircle width={20} height={20} /> Reached
        </PrimaryButton>
        <button type="button" disabled={busy}
          onClick={() => { setCancelReason(""); setCancelNote(""); setCancelErr(""); setOv("cancel"); }}
          className="w-full rounded-full border border-line py-3 text-[15px] font-semibold text-danger-fg disabled:opacity-50">
          Cancel request
        </button>
      </div>
    );
  } else if (viewStep === 1) {
    const canContinue = modelName.trim() && techPhotos.length > 0;
    body = (
      <>
        <Heading title="Purifier Details"
          sub={revisiting ? "Fix the model or add a photo, then save." : "Confirm the model and take photos."} />
        <Card className="mt-2">
          <FLabel icon={Icon.drop} must>Purifier Model</FLabel>
          <input className={input} placeholder="e.g. Kent RO Grand" value={modelName} onChange={(e) => setModelName(e.target.value)} />
        </Card>
        <Card className="mt-3">
          <FLabel icon={Icon.camera} must>Photos</FLabel>
          <div className="flex flex-wrap gap-2.5">
            {uploadedPhotos.map((url) => (
              <button key={url} type="button" aria-label="View photo" onClick={() => setOv("preview:" + url)} className="shrink-0">
                <JobPhoto src={url} alt="Job photo" className="h-[88px] w-[88px] rounded-2xl object-cover" />
              </button>
            ))}
            {queuedPhotos.map((src, i) => (
              <div key={`q${i}`} className="relative shrink-0">
                <img src={src} alt="Job photo waiting to upload" className="h-[88px] w-[88px] rounded-2xl object-cover opacity-80" />
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-2xl bg-warn-fg/90 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  <Icon.clock width={9} height={9} /> Pending
                </span>
              </div>
            ))}
            <button type="button" onClick={takeJobPhoto} disabled={photoBusy}
              aria-label={photoBusy ? "Uploading photo" : "Take job photo"} aria-busy={photoBusy || undefined}
              className="grid h-[88px] w-[88px] place-items-center rounded-2xl border-2 border-dashed border-hair bg-tonal text-brand disabled:opacity-50">
              <span className="grid place-items-center gap-0.5 text-center">
                {photoBusy ? <span className="text-xs">…</span> : <Icon.plus width={26} height={26} />}
                <small className="text-[11px] font-bold">ADD</small>
              </span>
            </button>
          </div>
        </Card>
      </>
    );
    footer = revisiting ? (
      <div className="flex gap-2.5">
        <GhostButton className="flex-1" onClick={discardRevisit}>
          <Icon.back width={18} height={18} /> Cancel
        </GhostButton>
        <PrimaryButton className="flex-[1.4] !bg-ok" disabled={!canContinue || busy} loading={busy} onClick={saveRevisit}>
          <Icon.checkCircle width={18} height={18} /> Save
        </PrimaryButton>
      </div>
    ) : (
      <PrimaryButton disabled={!canContinue || busy} loading={busy} onClick={() => advanceOnce("DIAGNOSED", { model_name: modelName.trim() })}>
        Continue <Icon.chevron width={19} height={19} />
      </PrimaryButton>
    );
  } else if (viewStep === 2) {
    // Same editor either way — reached normally before work starts, or stepped
    // back into from Work / Payment.
    body = (
      <>
        <Heading
          title={editBill ? "Edit the Bill" : "Make the Bill"}
          sub={editBill ? "Fix the charge or parts, then save." : "Pick the call type, set the charge, add parts."} />
        <SecH>1 · Type of call</SecH>
        {/* No icons, and tighter: the four labels already say what they are, and
            the icon block was what made each card tall enough to push the charge
            and the parts list off the first screenful. The tick still marks the
            choice, moved inline so nothing has to be reserved for it. */}
        <div className="grid grid-cols-2 gap-2">
          {CALL_TYPES.map((c) => {
            const on = callType === c.id;
            return (
              <button key={c.id} type="button" aria-pressed={on}
                onClick={() => {
                  setCallType(c.id);
                  // Installation has one fixed price; pre-fill it so the tech
                  // does not bill a new fit at the repair rate by habit.
                  if (c.id === "installation") setServiceCharge(INSTALLATION_CHARGE);
                }}
                className={cx(
                  "rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98]",
                  on ? "border-2 border-brand bg-brand-tint" : "border border-hair bg-surface"
                )}>
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-strong">{c.label}</span>
                  {on && (
                    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-brand text-white">
                      <Icon.check width={12} height={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-tight text-muted">{c.sub}</div>
              </button>
            );
          })}
        </div>
        <SecH>2 · Service charge</SecH>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[16px] font-bold text-strong">Amount to collect</div>
              <div className="mt-0.5 text-[12.5px] text-muted">Tap the number to type any amount</div>
            </div>
            <PlusMinus value={serviceCharge} min={0} max={SVC_MAX} step={SVC_STEP} wide
              format={(v) => (v === 0 ? "Free" : rupeeAmt(v))}
              onDelta={(d) => setServiceCharge((v) => Math.max(0, Math.min(SVC_MAX, v + d)))}
              onInput={setServiceCharge} />
          </div>
          <div className="mt-3 flex gap-2">
            {SVC_PRESETS.map((v) => {
              const on = serviceCharge === v;
              return (
                <button key={v} type="button" onClick={() => setServiceCharge(v)} aria-pressed={on}
                  className={cx(
                    "min-h-[44px] flex-1 rounded-full border text-sm font-bold transition",
                    on
                      ? v === 0 ? "border-transparent bg-ok text-white" : "border-transparent bg-brand text-white"
                      : "border-hair bg-transparent text-strong"
                  )}>
                  {v === 0 ? "Free" : rupeeAmt(v)}
                </button>
              );
            })}
          </div>
        </Card>
        <div className="mb-2 mt-5 flex items-center justify-between gap-2">
          <SecH bare>3 · Add parts</SecH>
          {parts.length > 0 && (
            <span className="tnum rounded-full bg-surface px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-muted shadow-card">
              {partsCount} {partsCount === 1 ? "item" : "items"}
            </span>
          )}
        </div>
        {/* Add sits directly under the section heading, with everything added
            listed beneath it, so the action stays put instead of being pushed
            further down the page by each part the technician adds. */}
        <button type="button" onClick={() => setOv("picker")}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand-tint text-[16px] font-semibold text-brand-dark transition active:scale-[0.985]">
          <Icon.plus width={20} height={20} /> Add Part
        </button>
        {/* No empty state: with the button sitting right here, a card saying
            "no parts yet, tap the button above" only repeats what the button
            already says. Nothing added ⇒ nothing to show. */}
        {parts.map((p, i) => {
          const overLimit = priceLimit(p);
          return (
            <div key={p.id ?? i} className={cx(
              "mt-2.5 rounded-2xl bg-surface p-3 shadow-card",
              overLimit && "ring-2 ring-danger"
            )}>
              <div className="flex items-start gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-bold leading-snug tracking-tight text-strong">{p.name}</div>
                  {partMeta(p) && (
                    <div className="mt-0.5 truncate text-[12.5px] font-semibold uppercase tracking-wide text-subtle">
                      {partMeta(p)}
                    </div>
                  )}
                </div>
                <button type="button" aria-label={`Remove ${p.name}`}
                  onClick={() => setParts(parts.filter((_, idx) => idx !== i))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger-tint text-danger">
                  <Icon.trash width={18} height={18} />
                </button>
              </div>
              {/* Rate × quantity and the line total share ONE row. They used to be
                  allowed to wrap, which pushed the total onto its own line and made
                  a single part look like two separate amounts. The compact rate
                  field and stepper are what buy the space to keep it on one line. */}
              <div className="mt-2 flex items-center gap-1.5">
                <PriceField compact invalid={!!overLimit} value={Number(p.price || 0)}
                  onCommit={(n) => setPartPrice(i, n)} label={`Rate for ${p.name}`} />
                <span className="shrink-0 text-[15px] font-semibold text-subtle">×</span>
                <PlusMinus compact value={partQty(p)} min={1} max={QTY_MAX} step={1}
                  onDelta={(d) => bumpPartQty(i, d)} onInput={(n) => setPartQtyAt(i, n)} />
                {/* Never truncate or wrap the money: at 99 × a ₹3,100 part this
                    reads ₹3,06,900, and a clipped total is worse than a narrower
                    rate pill. The pill shrinks first (see `compact` below). */}
                <span className={cx("tnum ml-auto shrink-0 whitespace-nowrap text-right text-[17px] font-extrabold tracking-tight",
                  overLimit ? "text-danger-fg" : "text-strong")}>
                  {rupeeAmt(partLineTotal(p))}
                </span>
              </div>
              {/* The limit that was breached, named. "Above MRP" alone would leave
                  the technician guessing what the ceiling actually is. */}
              {overLimit && (
                <div role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-danger-fg">
                  <Icon.alert width={15} height={15} className="shrink-0" />
                  {priceLimit(p).startsWith("MRP") ? `Above MRP — max ${overLimit.slice(4)}` : `Below minimum — min ${overLimit.slice(4)}`}
                </div>
              )}
            </div>
          );
        })}
        <Card className="mt-4">
          <Row l="Service charge" r={svcLabel(serviceCharge)} muted />
          {parts.map((p, i) => <Row key={p.id ?? i} l={partLabel(p)} r={rupeeAmt(partLineTotal(p))} muted />)}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
            <span className="text-[16px] font-bold text-strong">Total to collect</span>
            <RupeeCount value={estTotal} className="tnum text-[28px] font-extrabold tracking-tight text-strong" />
          </div>
        </Card>
        {/* Says why the button below is dead. A disabled button with no reason is
            how the technician concludes the app is broken. */}
        {badPrice && (
          <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-2xl bg-danger-tint p-3.5 text-[14.5px] font-semibold text-danger-fg">
            <Icon.alert width={19} height={19} className="mt-0.5 shrink-0" />
            A part is priced outside its allowed range. Fix the red one above to continue — the office will not accept this bill.
          </div>
        )}
        <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-brand-tint p-3.5 text-[14.5px] font-medium text-brand-dark">
          <Icon.eye width={19} height={19} className="shrink-0" />
          {editBill
            ? "Saving sends the customer the corrected amount on WhatsApp."
            : "Show this price to the customer before starting."}
        </div>
      </>
    );
    footer = editBill ? (
      <div className="flex gap-2.5">
        <GhostButton className="flex-1" onClick={discardRevisit}>
          <Icon.back width={18} height={18} /> Cancel
        </GhostButton>
        <PrimaryButton className="flex-[1.4] !bg-ok" disabled={busy || badPrice} loading={busy} onClick={saveRevisit}>
          <Icon.checkCircle width={18} height={18} /> Save Bill
        </PrimaryButton>
      </div>
    ) : (
      /* One tap from the bill to taking the money. The removed Work milestone's
         write still goes out from here — collectPayment records the estimate and
         then work-done before landing on Payment — so the office still gets
         work_done_at and the customer still gets both WhatsApp messages. */
      <PrimaryButton className="!bg-ok" disabled={busy || badPrice} loading={busy} onClick={collectPayment}>
        <Icon.bag width={19} height={19} /> Collect Payment <Icon.chevron width={18} height={18} />
      </PrimaryButton>
    );
  } else if (viewStep === 3) {
    if (st === "PAID") {
      body = (
        <Card className="mt-2 text-center !py-6">
          <IconChip tone="green" size={56} radius={16} className="mx-auto"><Icon.check width={28} height={28} /></IconChip>
          <div className="mt-2.5 text-[20px] font-extrabold text-strong">Payment recorded</div>
          <div className="mt-1 text-sm text-muted">Close the job to finish.</div>
        </Card>
      );
      footer = (
        <PrimaryButton disabled={busy} loading={busy} onClick={async () => { setBusy(true); await advance("CLOSED", { nextService: "6 months" }); setBusy(false); setCelebrate(true); }}>
          <Icon.checkCircle width={20} height={20} /> Close Job
        </PrimaryButton>
      );
    } else if (payScreen === "cash") {
      body = (
        <>
          <Card className="mt-2 text-center !py-6">
            <IconChip tone="green" size={58} radius={16} className="mx-auto"><Icon.cash width={30} height={30} /></IconChip>
            <div className="mt-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Take cash from customer</div>
            <div className="tnum text-[46px] font-extrabold tracking-tight text-strong">{rupeeAmt(billTotal)}</div>
          </Card>
          <SecH>Bill</SecH>
          <Card>
            {billLines}
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
              <span className="text-[16px] font-bold text-strong">Total</span>
              <span className="tnum text-[28px] font-extrabold text-strong">{rupeeAmt(billTotal)}</span>
            </div>
          </Card>
        </>
      );
      footer = (
        <div className="space-y-2.5">
          <PrimaryButton className="!bg-ok" disabled={busy} loading={busy} onClick={() => setOv("cashConfirm")}>
            <Icon.checkCircle width={20} height={20} /> Cash Received
          </PrimaryButton>
          <GhostButton className="w-full" onClick={() => goPay(null)}>
            <Icon.back width={17} height={17} /> Change payment method
          </GhostButton>
        </div>
      );
    } else if (payScreen === "upi") {
      body = (
        <>
          <Card className="mt-2 text-center">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">Scan to pay</div>
            <div className="tnum mb-3 mt-0.5 text-[32px] font-extrabold tracking-tight text-brand">{rupeeAmt(billTotal)}</div>
            <div className="mx-auto grid w-fit place-items-center rounded-2xl bg-white p-3 shadow-card"><UpiQr amount={billTotal} /></div>
            <div className="mt-2.5 text-[13px] text-muted">Customer scans with any UPI app</div>
          </Card>
          <Card className="mt-3">
            <FLabel icon={Icon.camera} must>Payment proof</FLabel>
            <div className="-mt-1 mb-2.5 text-sm text-muted">After they pay, photograph the success screen on their phone.</div>
            <ProofTile url={upiProofUrl} busy={photoBusy} onTake={takeProofPhoto} onView={() => upiProofUrl && setOv("preview:" + upiProofUrl)} />
          </Card>
        </>
      );
      footer = (
        <div className="space-y-2.5">
          <PrimaryButton className="!bg-ok" disabled={!upiProofUrl || photoBusy || busy} loading={busy} onClick={() => setOv("upiConfirm")}>
            <Icon.checkCircle width={20} height={20} /> Payment Received
          </PrimaryButton>
          <GhostButton className="w-full" onClick={() => { goPay(null); setUpiProofUrl(null); }}>
            <Icon.back width={17} height={17} /> Change payment method
          </GhostButton>
        </div>
      );
    } else if (payScreen === "split") {
      const cashN = Math.min(cashPart, billTotal);
      const both = upiDone && cashDone;
      const half = Math.round(billTotal / 2 / 50) * 50;
      body = (
        <>
          <SecH>Split — how much cash?</SecH>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[16px] font-bold text-strong">Cash part</div>
                <div className="mt-0.5 text-[12.5px] text-muted">Rest goes on UPI</div>
              </div>
              <PlusMinus value={cashN} min={0} max={billTotal} step={100} wide format={rupeeAmt}
                onDelta={(d) => { setCashPart((v) => Math.max(0, Math.min(billTotal, v + d))); setUpiDone(false); setCashDone(false); }}
                onInput={(n) => { setCashPart(n); setUpiDone(false); setCashDone(false); }} />
            </div>
            <div className="mt-3 flex gap-2">
              {[[0, "All UPI"], [half, "Half / Half"], [billTotal, "All Cash"]].map(([v, label]) => (
                <button key={label} type="button" aria-pressed={cashN === v}
                  onClick={() => { setCashPart(v); setUpiDone(false); setCashDone(false); }}
                  className={cx(
                    "min-h-[44px] flex-1 rounded-full border text-sm font-bold",
                    cashN === v ? "border-transparent bg-brand text-white" : "border-hair text-strong"
                  )}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[15px]">
              <span className="tnum font-semibold text-muted">Cash {rupeeAmt(cashN)} + UPI {rupeeAmt(upiRemainder)}</span>
              <span className="tnum font-extrabold text-strong">{rupeeAmt(billTotal)}</span>
            </div>
          </Card>
          <SecH>Collect both parts</SecH>
          <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
            <CollectRow done={upiDone} tone="blue" icon={Icon.phoneupi} label={`UPI ${rupeeAmt(upiRemainder)}`}
              disabled={upiRemainder === 0} onCollect={() => setOv("splitUpi")} />
            <CollectRow done={cashDone} tone="green" icon={Icon.cash} label={`Cash ${rupeeAmt(cashN)}`}
              disabled={cashN === 0} onCollect={() => setOv("splitCash")} />
          </div>
          {both ? (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-brand-tint p-3.5 text-[14.5px] font-medium text-brand-dark">
              <Icon.checkCircle width={19} height={19} className="shrink-0" /> Both parts collected. You can finish.
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-warn-tint p-3.5 text-[14.5px] font-medium text-warn-fg">
              <Icon.alert width={19} height={19} className="shrink-0" /> Collect both parts before you finish.
            </div>
          )}
        </>
      );
      const bothDone = (upiDone || upiRemainder === 0) && (cashDone || cashN === 0);
      footer = (
        <div className="space-y-2.5">
          <PrimaryButton className="!bg-ok" disabled={!bothDone || busy} loading={busy} onClick={() => setOv("splitConfirm")}>
            <Icon.checkCircle width={20} height={20} /> Finish Payment
          </PrimaryButton>
          <GhostButton className="w-full" onClick={() => { goPay(null); setUpiDone(false); setCashDone(false); setUpiProofUrl(null); }}>
            <Icon.back width={17} height={17} /> Change payment method
          </GhostButton>
        </div>
      );
    } else {
      body = (
        <>
          <SecH>Bill</SecH>
          <Card>
            {billLines}
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2.5">
              <span className="text-[16px] font-bold text-strong">Total to collect</span>
              <span className="tnum text-[32px] font-extrabold tracking-tight text-brand">{rupeeAmt(billTotal)}</span>
            </div>
            {/* Last chance to correct the bill: once payment is recorded the
                invoice is raised with a permanent number and cannot be edited. */}
            <GhostButton className="mt-3 w-full" onClick={() => goStep(2)}>
              <Icon.receipt width={17} height={17} /> Edit Bill
            </GhostButton>
          </Card>
          <SecH>How did customer pay?</SecH>
          <div className="overflow-hidden rounded-2xl bg-surface shadow-card">
            <PayRow tone="green" icon={Icon.cash} a="Cash" b="Customer gives cash" onClick={() => goPay("cash")} />
            <PayRow tone="blue" icon={Icon.phoneupi} a="UPI / Online" b="Show QR code to scan" onClick={() => goPay("upi")} />
            <PayRow tone="purple" icon={Icon.split} a="Part Cash + Part UPI" b="Split the money"
              onClick={() => { setCashPart(Math.round(billTotal / 2 / 50) * 50); setUpiDone(false); setCashDone(false); goPay("split"); }} />
          </div>
          <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-brand-tint p-3.5 text-[14.5px] font-medium text-brand-dark">
            <Icon.checkCircle width={19} height={19} className="shrink-0" /> You can go back and change the method any time before you confirm.
          </div>
        </>
      );
      footer = null;
    }
  }

  return (
    <div className="safe-x safe-top mx-auto flex h-screen w-full max-w-[440px] flex-col overflow-hidden bg-sunken">
      {/* Back closes the payment sub-screen first, then walks one milestone back
          per press, and only leaves the job from the first screen. The label is
          the destination, so the technician can see where a press will land. */}
      <JobHead job={job}
        onBack={payScreen ? () => goPay(null) : stepBack}
        label={payScreen ? "Payment" : viewStep > 0 && canRevisit ? STEPS[viewStep - 1].label : "Jobs"} />
      {/* Ticks stay on the real progress; the ring marks the screen on show. */}
      <JobSteps doneUpTo={liveStep} current={viewStep} />
      {/* Keyed on the milestone so the slide replays on every step change, and
          so each screen opens scrolled to its own top rather than inheriting
          the last one's scroll position. */}
      <main key={`${viewStep}:${payScreen ?? ""}`}
        className={cx("min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-1", stepDir === "back" ? "animate-step-back" : "animate-step")}>
        {body}
      </main>
      {footer && (
        <div className="bg-gradient-to-t from-sunken via-sunken/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
          {footer}
        </div>
      )}

      {ov === "reached" && (
        <MDialog title={`Reached ${job.name}?`} onClose={() => setOv(null)}
          icon={<Icon.pin width={24} height={24} className="text-ok-fg" />} iconClass="bg-ok-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setOv(null)}>Not yet</MDialogBtn>
              <MDialogBtn bold onClick={confirmReached}>Yes, I'm here</MDialogBtn>
            </>
          }>
          Confirm you are at the customer's home. This starts the job.
        </MDialog>
      )}
      {ov === "cancel" && (
        <MDialog title="Cancel this request?" onClose={() => setOv(null)}
          icon={<Icon.alert width={24} height={24} className="text-danger-fg" />} iconClass="bg-danger-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setOv(null)}>Keep job</MDialogBtn>
              <MDialogBtn bold disabled={busy} onClick={confirmCancel}>
                {busy ? "Cancelling…" : "Cancel request"}
              </MDialogBtn>
            </>
          }>
          <div className="space-y-3 text-left">
            <p className="text-[13px] text-subtle">
              {job.name} will get a WhatsApp message saying the request was cancelled, with the reason you pick.
            </p>
            <div className="space-y-1.5">
              {CANCEL_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-[14px]">
                  <input type="radio" name="cancel-reason" value={r}
                    checked={cancelReason === r}
                    onChange={() => { setCancelReason(r); setCancelErr(""); }}
                    className="h-4 w-4 accent-brand" />
                  <span>{r}</span>
                </label>
              ))}
            </div>
            {cancelReason === "Other" && (
              <textarea rows={2} value={cancelNote} autoFocus
                onChange={(e) => { setCancelNote(e.target.value); setCancelErr(""); }}
                placeholder="Tell the customer why"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-brand" />
            )}
            {cancelErr && <p className="text-[13px] font-medium text-danger-fg">{cancelErr}</p>}
          </div>
        </MDialog>
      )}
      {ov === "picker" && (
        <MSheet title="Add Part" onClose={() => setOv(null)}
          footer={<PrimaryButton onClick={() => setOv(null)}>Done</PrimaryButton>}>
          <input className={cx(input, "mb-3")} type="search" placeholder="Search parts…"
            value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
          {filteredParts.length === 0 && (
            <div className="py-6 text-center text-sm text-subtle">No matching parts.</div>
          )}
          {filteredParts.map((p) => {
            const added = parts.some((x) => x.id === p.id);
            return (
              <div key={p.id} className="mb-2.5 flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-card">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold text-strong">{p.name}</div>
                  <div className="tnum text-[13.5px] text-subtle">{p.brand} · {rupeeAmt(p.price)}</div>
                </div>
                <button type="button" onClick={() => togglePart(p)} aria-pressed={added}
                  aria-label={added ? `Remove ${p.name}` : `Add ${p.name}`}
                  className={cx(
                    "flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold",
                    added ? "bg-ok-tint text-ok-fg" : "bg-brand text-white"
                  )}>
                  {added ? <><Icon.check width={15} height={15} /> Added</> : <><Icon.plus width={15} height={15} /> Add</>}
                </button>
              </div>
            );
          })}
        </MSheet>
      )}
      {ov === "cashConfirm" && (
        <MDialog title={`Got ${rupeeAmt(billTotal)} in cash?`} onClose={() => setOv(null)}
          icon={<Icon.cash width={24} height={24} className="text-ok-fg" />} iconClass="bg-ok-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setOv(null)}>No</MDialogBtn>
              <MDialogBtn bold onClick={() => finishPayment([{ method: "Cash", amount: billTotal }], "Cash", false)}>Yes, received</MDialogBtn>
            </>
          }>
          Only press Yes after the customer has handed over the full cash.
        </MDialog>
      )}
      {ov === "upiConfirm" && (
        <MDialog title={`Got ${rupeeAmt(billTotal)} on UPI?`} onClose={() => setOv(null)}
          icon={<Icon.phoneupi width={24} height={24} className="text-brand" />} iconClass="bg-brand-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setOv(null)}>No</MDialogBtn>
              <MDialogBtn bold onClick={() => finishPayment([{ method: "UPI", amount: billTotal }], "UPI", false)}>Yes, received</MDialogBtn>
            </>
          }>
          Only press Yes after you have seen the payment success and taken the proof photo.
        </MDialog>
      )}
      {ov === "splitUpi" && (
        <MSheet title={`Collect UPI ${rupeeAmt(upiRemainder)}`} onClose={() => setOv(null)}
          footer={
            <PrimaryButton className="!bg-ok" disabled={!upiProofUrl || photoBusy} onClick={() => { setUpiDone(true); setOv(null); }}>
              <Icon.check width={18} height={18} /> UPI Received
            </PrimaryButton>
          }>
          <Card className="text-center">
            <div className="mx-auto grid w-fit place-items-center rounded-2xl bg-white p-3 shadow-card"><UpiQr amount={upiRemainder} /></div>
            <div className="mt-2.5 text-[13px] text-muted">Customer scans with any UPI app</div>
          </Card>
          <Card className="mb-3 mt-3">
            <FLabel icon={Icon.camera} must>Payment proof</FLabel>
            <div className="-mt-1 mb-2.5 text-sm text-muted">Photograph the success screen on their phone.</div>
            <ProofTile url={upiProofUrl} busy={photoBusy} onTake={takeProofPhoto} onView={() => upiProofUrl && setOv("preview:" + upiProofUrl)} />
          </Card>
        </MSheet>
      )}
      {ov === "splitCash" && (
        <MDialog title={`Got ${rupeeAmt(Math.min(cashPart, billTotal))} in cash?`} onClose={() => setOv(null)}
          icon={<Icon.cash width={24} height={24} className="text-ok-fg" />} iconClass="bg-ok-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setOv(null)}>No</MDialogBtn>
              <MDialogBtn bold onClick={() => { setCashDone(true); setOv(null); }}>Yes, received</MDialogBtn>
            </>
          }>
          This is the cash part of the split.
        </MDialog>
      )}
      {ov === "splitConfirm" && (
        <MDialog title="Finish payment?" onClose={() => setOv(null)}
          icon={<Icon.split width={24} height={24} className="text-brand" />} iconClass="bg-brand-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setOv(null)}>Back</MDialogBtn>
              <MDialogBtn bold onClick={() => {
                const cashN = Math.min(cashPart, billTotal);
                const payments = [];
                if (cashN > 0) payments.push({ method: "Cash", amount: cashN });
                if (upiRemainder > 0) payments.push({ method: "UPI", amount: upiRemainder });
                finishPayment(payments, payments.map((p) => p.method).join(" + "), payments.length > 1);
              }}>Finish</MDialogBtn>
            </>
          }>
          Cash {rupeeAmt(Math.min(cashPart, billTotal))} + UPI {rupeeAmt(upiRemainder)} = <b>{rupeeAmt(billTotal)}</b>
        </MDialog>
      )}
      {ov?.startsWith("preview:") && <ImagePreview src={ov.slice(8)} onClose={() => setOv(null)} />}
      {shot && <PhotoConfirm src={shot.dataUrl} kind={shot.kind} onKeep={keepShot} onRetake={retakeShot} onBack={discardShot} />}
    </div>
  );
}

/* ------------------------------ small pieces ------------------------------ */

/* `bare` drops the outer spacing so the heading can sit in a flex row next to a
   count chip without fighting the row's own margins. */
const SecH = ({ children, bare }) => (
  <div className={cx("text-[12.5px] font-semibold uppercase tracking-wide text-muted", bare ? "mx-1" : "mx-1 mb-2 mt-5")}>{children}</div>
);

/* Per-piece rate on a part line: tap to type any amount. Stays a plain field
   rather than a stepper because the quantity stepper sits beside it and two
   steppers on one row do not fit a phone. Committed clamped to [min, max] —
   the technician may discount a part but never charge above its MRP. */
function PriceField({ value, onCommit, label, compact, invalid }) {
  // No clamping here either: the caller decides what an out-of-range price means,
  // and on a part row it means "show the limit in red", not "quietly change it".
  //
  // Committed per keystroke rather than on blur, for the same reason as PlusMinus:
  // the tap that blurs the field is usually the ± stepper or Save Bill, and a
  // commit deferred to blur had not reached `parts` by the time those ran — so an
  // edited rate was dropped from the bill that was saved.
  const [editing, setEditing] = useState(null);
  const type = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 7);
    setEditing(digits);
    onCommit(Number(digits) || 0);
  };
  return (
    <input type="text" inputMode="numeric" aria-label={label || "Rate"}
      aria-invalid={invalid || undefined}
      className={cx("tnum rounded-full border bg-transparent text-center text-[15px] font-bold outline-none",
        invalid
          ? "border-2 border-danger bg-danger-tint text-danger-fg"
          : "border-hair text-strong focus:border-brand",
        // Compact is the only variant allowed to shrink: on a part row it yields
        // width so a large line total stays fully readable.
        compact ? "w-[86px] min-w-[64px] px-2 py-2" : "w-[104px] shrink-0 px-3 py-2.5")}
      value={editing != null ? editing : rupeeAmt(value)}
      onFocus={(e) => { setEditing(value ? String(value) : ""); e.target.select(); }}
      onChange={(e) => type(e.target.value)}
      onBlur={() => setEditing(null)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
  );
}

/* Mockup .jobhead — back chevron + centred name/code. */
function JobHead({ job, onBack, label = "Jobs" }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-2">
      <button type="button" onClick={onBack} aria-label="Back"
        className="flex min-h-[44px] items-center gap-0.5 px-1.5 text-[17px] font-medium text-brand">
        <Icon.back width={20} height={20} /> {label}
      </button>
      <div className="min-w-0 flex-1 pr-[64px] text-center">
        <div className="truncate text-[16px] font-bold text-strong">{job.name}</div>
        <div className="truncate text-xs text-subtle">{job.code} · {job.model || "—"}</div>
      </div>
    </div>
  );
}

/* UPI proof photo: dashed ADD tile, or the taken shot. */
function ProofTile({ url, busy, onTake, onView }) {
  if (url) {
    return (
      <button type="button" onClick={onView} className="shrink-0" aria-label="View payment proof">
        <JobPhoto src={url} alt="UPI payment proof" className="h-[88px] w-[88px] rounded-2xl border-2 border-ok/50 object-cover" />
      </button>
    );
  }
  return (
    <button type="button" onClick={onTake} disabled={busy}
      aria-label={busy ? "Uploading payment proof" : "Take payment proof photo"} aria-busy={busy || undefined}
      className="grid h-[88px] w-[88px] place-items-center rounded-2xl border-2 border-dashed border-hair bg-tonal text-brand disabled:opacity-50">
      <span className="grid place-items-center gap-0.5 text-center">
        {busy ? <span className="text-xs">…</span> : <Icon.plus width={26} height={26} />}
        <small className="text-[11px] font-bold">ADD</small>
      </span>
    </button>
  );
}

/* Payment method row (mockup .payrow). */
function PayRow({ tone, icon: Ic, a, b, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="relative flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left [&+&]:border-t [&+&]:border-line">
      <IconChip tone={tone}><Ic width={20} height={20} /></IconChip>
      <span className="flex-1">
        <span className="block text-[17px] font-semibold tracking-tight text-strong">{a}</span>
        <span className="mt-0.5 block text-[13px] text-subtle">{b}</span>
      </span>
      <Icon.chevron width={19} height={19} className="text-hair" />
    </button>
  );
}

/* Split-collect row: tap to collect, turns green when done. */
function CollectRow({ done, tone, icon: Ic, label, disabled, onCollect }) {
  return (
    <button type="button" disabled={disabled || done} onClick={onCollect}
      className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-100 [&+&]:border-t [&+&]:border-line">
      <IconChip tone={done ? "green" : tone}>{done ? <Icon.check width={20} height={20} /> : <Ic width={20} height={20} />}</IconChip>
      <span className="flex-1">
        <span className="block text-[17px] font-semibold tracking-tight text-strong">{label}</span>
        <span className="mt-0.5 block text-[13px] text-subtle">{done ? "Collected" : disabled ? "Nothing to collect" : "Tap to collect"}</span>
      </span>
      {done ? (
        <span className="text-[13px] font-bold text-ok-fg">Done</span>
      ) : disabled ? null : (
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold text-brand-dark">Collect</span>
      )}
    </button>
  );
}

/* Confirm a shot before it is saved. Full-screen so the technician can actually
   judge it. "Use photo" queues it; "Retake" reopens the camera; "Back" (or the
   phone's back button) discards it — nothing has been uploaded at this point. */
function PhotoConfirm({ src, kind, onKeep, onRetake, onBack }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Use this photo?" className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
        <button type="button" onClick={onBack} aria-label="Back, discard photo"
          className="grid h-11 w-11 place-items-center rounded-full text-white active:bg-white/15">
          <Icon.back width={22} height={22} />
        </button>
        <div className="flex-1 text-[15px] font-semibold text-white">
          {kind === "proof" ? "Payment proof" : "Job photo"}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <img src={src} alt="Photo to confirm" className="max-h-full max-w-full rounded-2xl object-contain" />
      </div>
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
        <div className="mb-3 text-center text-sm text-white/70">Use this photo?</div>
        <div className="flex gap-2.5">
          <button type="button" onClick={onBack}
            className="min-h-[52px] flex-1 rounded-2xl bg-white/10 text-[15px] font-semibold text-white active:bg-white/20">
            Back
          </button>
          <button type="button" onClick={onRetake}
            className="min-h-[52px] flex-1 rounded-2xl bg-white/10 text-[15px] font-semibold text-white active:bg-white/20">
            Retake
          </button>
          <button type="button" onClick={onKeep}
            className="min-h-[52px] flex-[1.4] rounded-2xl bg-brand text-[15px] font-bold text-white active:opacity-90">
            Use photo
          </button>
        </div>
      </div>
    </div>
  );
}

function ImagePreview({ src, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/90" onClick={onClose} />
      <div className="pointer-events-none fixed inset-4 z-[70] flex items-center justify-center">
        <JobPhoto src={src} alt="Preview" className="max-h-full max-w-full rounded-2xl object-contain" />
      </div>
      <button type="button" onClick={onClose} aria-label="Close preview"
        className="fixed right-5 top-5 z-[71] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-2xl text-white">×</button>
    </>
  );
}
