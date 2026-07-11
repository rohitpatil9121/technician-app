import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { chargeTypes } from "../data/mock.js";
import { rupee, rupeeAmt } from "../lib/format.js";
import { api, mediaUrl } from "../lib/api.js";
import { callPhone, openMaps, openWhatsApp } from "../lib/contact.js";
import { takePhoto } from "../lib/camera.js";
import {
  loadJobDraft, saveJobDraft, clearJobDraft, markPhotoStart, clearPhotoMark, pinRoute, acknowledgeJobResume, applyJobDraft, leaveJobScreen,
} from "../lib/jobDraft.js";
import { App as CapApp } from "@capacitor/app";
import UpiQr from "../components/UpiQr.jsx";
import {
  Icon, Tag, StatusPill, Card, PrimaryButton, GhostButton, input, cx, Stepper, Skeleton,
} from "../components/ui.jsx";
import { stepIndexForStatus, STEPS } from "../lib/workflow.js";

const PROBLEMS = [
  "No water", "Low water flow", "Leakage", "Bad taste", "Pump issue",
  "Filter issue", "Membrane issue", "Installation issue", "Other",
];
const BRANDS = [
  { id: "kent", label: "Kent" }, { id: "aquaguard", label: "Aquaguard" },
  { id: "oasis", label: "Oasis" }, { id: "other", label: "Other" },
];

const SectionTitle = ({ children, required }) => (
  <div className="mt-4 text-sm font-bold text-slate-700">
    {children} {required && <span className="text-danger">REQUIRED</span>}
  </div>
);
const Row = ({ l, r, bold, muted }) => (
  <div className={cx("flex items-center justify-between py-0.5", muted ? "text-sm text-slate-500" : "text-slate-700", bold && "font-bold")}>
    <span>{l}</span><span>{r}</span>
  </div>
);

export default function JobDetail() {
  const { id } = useParams();
  const { getJob } = useJobs();
  const job = getJob(id);
  // Wait for the job to load (e.g. deep-linked from a push) before mounting the
  // form, and key by id so the editable state seeds from saved work correctly.
  if (!job) {
    return (
      <div className="safe-x flex min-h-screen flex-col bg-slate-100 px-4 pt-4">
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
  const { updateJob, setJob, parts: partsCatalog, loadJobs, live } = useJobs();
  const w = job.work || {};
  const draft = loadJobDraft(job.id);

  /* editable state (seeded from saved work + local draft if WebView reloaded) */
  const [problems, setProblems] = useState(draft?.problems ?? w.problems ?? []);
  const [parts, setParts] = useState(draft?.parts ?? w.parts ?? []);
  const [charge, setCharge] = useState(draft?.charge ?? w.charge ?? (job?.visitCharge === 0 ? "warranty" : "service"));
  const [partBrand, setPartBrand] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  /* diagnosis: typable model + custom "Other" problem */
  const [modelName, setModelName] = useState(
    draft?.modelName ?? w.model_name ?? (job.model && job.model !== "—" ? job.model : "")
  );
  const [otherText, setOtherText] = useState(draft?.otherText ?? w.other_problem ?? "");
  /* Start Travel confirm popup */
  const [showTravel, setShowTravel] = useState(false);
  /* TDS readings — tap + filter water, taken before (in) and after (out) work */
  const [tapIn, setTapIn] = useState(draft?.tapIn ?? w.tds_in_tap ?? "");
  const [filterIn, setFilterIn] = useState(draft?.filterIn ?? w.tds_in_filter ?? "");
  const [tapOut, setTapOut] = useState(draft?.tapOut ?? w.tds_out_tap ?? "");
  const [filterOut, setFilterOut] = useState(draft?.filterOut ?? w.tds_out_filter ?? "");
  /* arrival OTP */
  const [otpSent, setOtpSent] = useState(false);
  const [arrCode, setArrCode] = useState("");
  const [arrErr, setArrErr] = useState("");
  const [busy, setBusy] = useState(false);
  /* modals */
  const [showCust, setShowCust] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [upiProofUrl, setUpiProofUrl] = useState(null);
  /* split payment: cash portion (rest goes on UPI) */
  const [cashAmt, setCashAmt] = useState(draft?.cashAmt ?? "");
  const [photoPreview, setPhotoPreview] = useState(null);

  const draftRef = useRef({});
  draftRef.current = {
    problems, parts, charge, modelName, otherText, tapIn, filterIn, tapOut, filterOut, cashAmt,
  };

  useEffect(() => {
    const path = `/job/${job.id}`;
    pinRoute(path);
    const d = loadJobDraft(job.id);
    applyJobDraft(d, {
      setProblems, setParts, setCharge, setModelName, setOtherText,
      setTapIn, setFilterIn, setTapOut, setFilterOut, setCashAmt,
    });
    acknowledgeJobResume();
  }, [job.id]);

  // Save draft when app backgrounds (camera opens — WebView may reload after this).
  useEffect(() => {
    const flush = () => saveJobDraft(job.id, draftRef.current);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    let sub;
    CapApp.addListener("appStateChange", ({ isActive }) => { if (!isActive) flush(); })
      .then((h) => { sub = h; })
      .catch(() => {});
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      sub?.remove?.();
    };
  }, [job.id]);

  // Auto-save draft so camera / app resume doesn't wipe filled fields.
  useEffect(() => {
    const t = setTimeout(() => saveJobDraft(job.id, draftRef.current), 150);
    return () => clearTimeout(t);
  }, [job.id, problems, parts, charge, modelName, otherText, tapIn, filterIn, tapOut, filterOut, cashAmt]);

  const st = job.status;

  const advance = useCallback((status, work) => {
    updateJob(job.id, { status, work });
    if (status !== st) clearJobDraft(job.id);
  }, [job.id, st, updateJob]);

  // Customer approve/reject comes via WhatsApp — poll faster while waiting.
  useEffect(() => {
    if (!live || st !== "ESTIMATE_SENT") return;
    loadJobs();
    const timer = setInterval(loadJobs, 5000);
    return () => clearInterval(timer);
  }, [live, st, loadJobs, job.id]);

  const chargeAmt = chargeTypes.find((c) => c.id === charge)?.amount ?? 0;
  const partsTotal = parts.reduce((s, p) => s + Number(p.price || 0), 0);
  const estTotal = chargeAmt + partsTotal;
  const billTotal = Number(w.total ?? estTotal);

  const toggleProblem = (p) => setProblems((a) => (a.includes(p) ? a.filter((x) => x !== p) : [...a, p]));
  // Keep the catalogue MRP so edits can be validated against it (price is editable).
  const addPartObj = (p) => setParts((prev) => [...prev, { ...p, mrp: Number(p.price || 0), minPrice: Number(p.minPrice || 0) }]);
  const setPartPrice = (i, val) => setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, price: val } : p)));
  // Price must stay between the part's minimum price and MRP (each only if set).
  const partPriceError = (p) => {
    const price = Number(p.price || 0);
    if (p.minPrice > 0 && price < p.minPrice) return `Min ₹${p.minPrice}`;
    if (p.mrp > 0 && price > p.mrp) return `MRP ₹${p.mrp}`;
    return "";
  };
  const priceInvalid = parts.some((p) => partPriceError(p));
  const filteredParts = partsCatalog.filter((p) =>
    (!partBrand || p.brand === partBrand) && (!partSearch || p.name.toLowerCase().includes(partSearch.toLowerCase())));

  const sendArrivalOtp = async () => {
    setArrErr(""); setBusy(true);
    try { await api.arrivalOtp(job.id); setOtpSent(true); }
    catch (e) { setArrErr(e.message); }
    finally { setBusy(false); }
  };
  const verifyArrival = async () => {
    setArrErr(""); setBusy(true);
    try {
      const res = await api.verifyArrival(job.id, arrCode);
      if (res.ok) setJob(res.job); else setArrErr(res.error || "Invalid code");
    } catch (e) { setArrErr(e.message); }
    finally { setBusy(false); }
  };
  // Split payment: cash portion (clamped) + UPI remainder.
  const cashN = Math.min(Number(cashAmt || 0), billTotal);
  const upiDue = Math.max(0, billTotal - cashN);
  // Whole amount in cash.
  const markCashFull = () => advance("PAID", { payments: [{ method: "Cash", amount: billTotal }], total: billTotal, mode: "Cash" });
  // Called from the UPI QR modal: books the UPI remainder + any cash portion entered.
  const markUpiPaid = () => {
    const payments = [];
    if (cashN > 0) payments.push({ method: "Cash", amount: cashN });
    payments.push({ method: "UPI", amount: upiDue });
    const mode = payments.map((p) => p.method).join(" + ");
    advance("PAID", { payments, total: billTotal, mode, split: payments.length > 1 });
  };

  const takePaymentProofPhoto = async () => {
    saveJobDraft(job.id, draftRef.current);
    markPhotoStart(`/job/${job.id}`);
    setPhotoBusy(true);
    try {
      const dataUrl = await takePhoto();
      const res = await api.uploadPhoto(job.id, dataUrl);
      if (res.ok) {
        setJob(res.job);
        const photos = res.job.work?.tech_photos || [];
        setUpiProofUrl(photos[photos.length - 1] || null);
      }
      clearPhotoMark();
    } catch {
      clearPhotoMark();
    } finally {
      setPhotoBusy(false);
    }
  };

  const closeQrModal = () => {
    setShowQr(false);
    setUpiProofUrl(null);
  };

  const takeJobPhoto = async () => {
    saveJobDraft(job.id, draftRef.current);
    markPhotoStart(`/job/${job.id}`);
    setPhotoBusy(true);
    try {
      const dataUrl = await takePhoto();
      const res = await api.uploadPhoto(job.id, dataUrl);
      if (res.ok) setJob(res.job);
      clearPhotoMark();
    } catch {
      clearPhotoMark();
    } finally {
      setPhotoBusy(false);
    }
  };
  const techPhotos = w.tech_photos || [];

  /* ------------------------------ CLOSED ------------------------------ */
  if (st === "CLOSED") {
    const paid = w.total ?? billTotal;
    return (
      <Shell job={job} nav={nav} onBack={() => { leaveJobScreen(); nav("/home"); }}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center animate-in">
          <div className="animate-scale-in grid h-20 w-20 place-items-center rounded-full bg-ok-light text-ok">
            <Icon.checkCircle width={40} height={40} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-800">Job Closed</h2>
          <p className="text-slate-500">{job.name} • {job.area}</p>
          <Card className="mt-5 w-full max-w-xs !py-3 text-left">
            <Row l="Ticket" r={job.code} muted />
            {paid > 0 && <Row l="Amount" r={rupeeAmt(paid)} bold />}
            {w.mode && <Row l="Payment" r={w.mode} muted />}
            {job.rating != null ? (
              <Row l="Rating" r={<span className="text-amber-500">{"★".repeat(job.rating)}</span>} />
            ) : (
              <div className="mt-2 rounded-lg bg-brand-50 px-2.5 py-2 text-xs text-brand-dark">
                Customer will rate on WhatsApp shortly
              </div>
            )}
          </Card>
          <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2">
            <GhostButton onClick={() => nav("/home")}>Back to Jobs</GhostButton>
            <PrimaryButton className="!py-3" onClick={() => nav("/reviews")}>My Reviews</PrimaryButton>
          </div>
        </div>
      </Shell>
    );
  }

  let body = null, footer = null;

  /* --------------------------- 1. Start Travel --------------------------- */
  if (st === "NEW") {
    body = <Heading title="Ready to go?" sub="Start travel to the customer." />;
    footer = <PrimaryButton onClick={() => setShowTravel(true)}><Icon.truck width={18} height={18} /> Start Travel</PrimaryButton>;

  /* ----------------------------- 2. On the Way + Reached OTP ----------------------------- */
  } else if (st === "ON_THE_WAY") {
    body = (
      <>
        <Heading title="On the way" sub="Tap Reached when you arrive. The customer gets an OTP to confirm." />
        {otpSent && (
          <>
            <SectionTitle required>Enter customer OTP</SectionTitle>
            <input className={cx(input, "mt-2 text-center tracking-[0.5em]")} inputMode="numeric" maxLength={4}
              placeholder="••••" value={arrCode} onChange={(e) => setArrCode(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            {arrErr && <div className="mt-2 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{arrErr}</div>}
          </>
        )}
        {!otpSent && arrErr && <div className="mt-3 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{arrErr}</div>}
      </>
    );
    footer = otpSent ? (
      <PrimaryButton disabled={arrCode.length < 4 || busy} onClick={verifyArrival}><Icon.check width={18} height={18} /> {busy ? "Verifying…" : "Verify OTP"}</PrimaryButton>
    ) : (
      <PrimaryButton disabled={busy} onClick={sendArrivalOtp}><Icon.pin width={18} height={18} /> {busy ? "Sending…" : "Reached"}</PrimaryButton>
    );

  /* ----------------------------- 3. Diagnosis ----------------------------- */
  } else if (st === "ARRIVED") {
    body = (
      <>
        <Heading title="Diagnosis" sub="Enter the model, select the problem, take a photo, then estimate." />
        <SectionTitle required>Model name</SectionTitle>
        <input className={cx(input, "mt-2")} placeholder="e.g. Kent RO Grand Plus" value={modelName} onChange={(e) => setModelName(e.target.value)} />
        <SectionTitle required>Problem Found</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROBLEMS.map((p) => (
            <button key={p} onClick={() => toggleProblem(p)}
              className={cx("rounded-full border px-3 py-1.5 text-sm", problems.includes(p) ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600")}>{p}</button>
          ))}
        </div>
        {problems.includes("Other") && (
          <input className={cx(input, "mt-2")} placeholder="Describe the problem…" value={otherText} onChange={(e) => setOtherText(e.target.value)} />
        )}

        <SectionTitle required>TDS readings (ppm)</SectionTitle>
        <TdsPair tap={tapIn} filter={filterIn} onTap={setTapIn} onFilter={setFilterIn} />

        <SectionTitle>Photos</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {techPhotos.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
              <img src={url} alt="Job" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
            </a>
          ))}
          <button onClick={takeJobPhoto} disabled={photoBusy}
            className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 disabled:opacity-50">
            {photoBusy ? <span className="text-xs">…</span> : <Icon.camera width={24} height={24} />}
          </button>
        </div>
      </>
    );
    footer = (
      <PrimaryButton
        disabled={problems.length === 0 || !modelName.trim() || !tapIn || !filterIn || (problems.includes("Other") && !otherText.trim())}
        onClick={() => advance("DIAGNOSED", { problems, model_name: modelName.trim(), other_problem: otherText.trim(), tds_in_tap: tapIn, tds_in_filter: filterIn })}>
        Continue to Estimate
      </PrimaryButton>
    );

  /* ----------------------------- 4-5. Create Estimate ----------------------------- */
  } else if (st === "DIAGNOSED") {
    body = (
      <>
        <Heading title="Create estimate" sub="Set the charge and add parts." />
        <SectionTitle>Charge type</SectionTitle>
        <div className="mt-2">
          {/* Collapsed dropdown — shows the selected charge; tap to pick from all 4. */}
          <button onClick={() => setChargeOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left">
            <span className="text-sm font-medium text-slate-700">{chargeTypes.find((c) => c.id === charge)?.label || "Service Charge"}</span>
            <span className="flex items-center gap-2">
              <span className={cx("text-sm font-bold", chargeAmt === 0 ? "text-ok" : "text-slate-700")}>{rupee(chargeAmt)}</span>
              <Icon.chevronDown width={16} height={16} className={cx("text-slate-400 transition", chargeOpen && "rotate-180")} />
            </span>
          </button>
          {chargeOpen && (
            <div className="mt-1 space-y-1 rounded-xl border border-slate-100 p-1">
              {chargeTypes.map((c) => (
                <button key={c.id} onClick={() => { setCharge(c.id); setChargeOpen(false); }}
                  className={cx("flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left", charge === c.id ? "bg-brand-50" : "hover:bg-slate-50")}>
                  <span className="text-sm font-medium text-slate-700">{c.label}</span>
                  <span className={cx("text-sm font-bold", c.amount === 0 ? "text-ok" : "text-slate-700")}>{rupee(c.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <SectionTitle>Parts</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {BRANDS.map((b) => (
            <button key={b.id} onClick={() => setPartBrand(partBrand === b.id ? "" : b.id)}
              className={cx("rounded-full border px-3 py-1.5 text-sm", partBrand === b.id ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600")}>{b.label}</button>
          ))}
        </div>
        {/* List stays hidden until the tech taps "Add Items" — keeps the screen
            clean; the catalog only opens on demand (optionally brand-filtered). */}
        {!pickerOpen ? (
          <button onClick={() => setPickerOpen(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 py-2.5 text-sm font-semibold text-brand">
            <Icon.plus width={16} height={16} /> Add Items
          </button>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
              <Icon.search width={16} height={16} className="text-slate-400" />
              <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search part…" value={partSearch}
                onFocus={() => setSearchActive(true)} onChange={(e) => setPartSearch(e.target.value)} />
              <button onClick={() => { setPickerOpen(false); setSearchActive(false); setPartSearch(""); }} className="shrink-0 text-sm font-semibold text-slate-400">Done</button>
            </div>
            {/* List opens only after the tech taps the search field — not before. */}
            {searchActive && (
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-1">
                {filteredParts.length === 0 ? <div className="px-2 py-3 text-center text-sm text-slate-400">No matching parts.</div>
                  : filteredParts.map((p) => (
                    <button key={p.id} onClick={() => addPartObj(p)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50">
                      <span className="text-slate-700">{p.name}</span>
                      <span className="flex items-center gap-2 text-slate-400"><span>{rupee(p.price)}</span><Icon.plus width={15} height={15} className="text-brand" /></span>
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
        {parts.length > 0 && (
          <div className="mt-2 space-y-2">
            {parts.map((p, i) => {
              const perr = partPriceError(p);
              return (
                <div key={i} className={`rounded-xl border px-3 py-2 ${perr ? "border-red-300 bg-red-50/50" : "border-slate-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">₹</span>
                      <input className={`w-20 rounded-lg px-2 py-1 text-right text-sm ${perr ? "bg-red-100 text-red-700" : "bg-slate-100"}`} inputMode="numeric" value={p.price} onChange={(e) => setPartPrice(i, e.target.value)} />
                      <button onClick={() => setParts(parts.filter((_, idx) => idx !== i))} className="text-slate-400"><Icon.trash width={16} height={16} /></button>
                    </div>
                  </div>
                  {perr && <div className="mt-1 text-right text-xs font-semibold text-red-500">{perr.startsWith("Min") ? `Price can't go below ${perr.slice(4)}` : `Price can't go above ${perr.slice(4)}`}</div>}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 p-3">
          <div className="font-bold text-slate-800">Estimate</div>
          <Row l={chargeTypes.find((c) => c.id === charge)?.label} r={rupee(chargeAmt)} />
          {parts.map((p, i) => <Row key={i} l={p.name} r={rupeeAmt(p.price)} muted />)}
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="font-bold text-slate-800">Total</span><span className="text-lg font-extrabold text-brand">{rupeeAmt(estTotal)}</span>
          </div>
        </div>
      </>
    );
    footer = (
      <div className="grid grid-cols-2 gap-2">
        <GhostButton onClick={() => setShowCust(true)}>Show Customer</GhostButton>
        <PrimaryButton disabled={priceInvalid} onClick={() => advance("ESTIMATE_SENT", { parts, charge, problems, total: estTotal })}>Send Estimate</PrimaryButton>
      </div>
    );

  /* ----------------------------- 6. Waiting for customer ----------------------------- */
  } else if (st === "ESTIMATE_SENT") {
    body = (
      <>
        <Heading title="Estimate sent" sub="Waiting for the customer's WhatsApp response (Approve / Reject)." />
        <div className="mt-3 rounded-2xl border border-slate-200 p-3">
          <Row l={chargeTypes.find((c) => c.id === charge)?.label} r={rupee(chargeAmt)} />
          {parts.map((p, i) => <Row key={i} l={p.name} r={rupeeAmt(p.price)} muted />)}
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="font-bold">Total</span><span className="font-extrabold text-brand">{rupeeAmt(billTotal)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-dark">
          <Icon.clock width={16} height={16} /> Checking every few seconds for the customer's reply…
        </div>
      </>
    );
    footer = (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <GhostButton onClick={() => setShowCust(true)}>Show Estimate</GhostButton>
          <GhostButton onClick={() => advance("DIAGNOSED")}>✎ Edit &amp; Resend</GhostButton>
        </div>
        <GhostButton className="!border-danger/30 !text-danger" onClick={() => advance("WORK_DONE", { charge: "visit", total: 250, visitOnly: true })}>Collect Visit Charge Only</GhostButton>
      </div>
    );

  /* ----------------------------- 7. Approved → Start Work / Work ----------------------------- */
  } else if (st === "VERIFIED") {
    if (!w.work_started) {
      body = <Heading title="Estimate approved" sub="The customer approved. Start the work." tone="ok" />;
      footer = <PrimaryButton className="!bg-ok" onClick={() => advance("VERIFIED", { work_started: true })}><Icon.check width={18} height={18} /> Start Work</PrimaryButton>;
    } else {
      const canFinish = !!filterOut;
      body = (
        <>
          <Heading title="Work in progress" sub="Enter water filter TDS reading to finish the work." />
          <SectionTitle required>Water filter TDS (ppm)</SectionTitle>
          <TdsSingle value={filterOut} onChange={setFilterOut} placeholder="40" />
        </>
      );
      footer = (
        <PrimaryButton
          disabled={!canFinish}
          onClick={() => advance("WORK_DONE", { total: billTotal, tds_out_filter: filterOut })}
        >
          <Icon.checkCircle width={18} height={18} /> Work Done
        </PrimaryButton>
      );
    }

  /* ----------------------------- 8. Rejected ----------------------------- */
  } else if (st === "REJECTED") {
    body = <Heading title="Estimate rejected" sub="The customer declined the estimate." tone="warn" />;
    footer = (
      <div className="space-y-2">
        <PrimaryButton onClick={() => advance("DIAGNOSED")}>Create Revised Estimate</PrimaryButton>
        <GhostButton className="!border-danger/30 !text-danger" onClick={() => advance("WORK_DONE", { charge: "visit", total: 250, visitOnly: true })}>Collect Visit Charge Only</GhostButton>
      </div>
    );

  /* ----------------------------- 9. Payment ----------------------------- */
  } else if (st === "WORK_DONE") {
    body = (
      <>
        <Heading title="Collect payment" sub="Full cash, full UPI, or split between both." />
        {w.visitOnly && <div className="mt-2 rounded-xl bg-warn-light p-2 text-sm text-warn">Visit charge only — estimate not approved.</div>}
        <div className="mt-3 rounded-2xl border-2 border-brand/20 bg-gradient-to-br from-brand-50 to-white p-5 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amount due</div>
          <div className="mt-1 text-4xl font-extrabold text-brand">{rupeeAmt(billTotal)}</div>
        </div>

        {/* Split: enter the cash part, the rest is collected on UPI via the QR. */}
        <SectionTitle>Split payment (optional)</SectionTitle>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-sm text-slate-500">Cash ₹</span>
            <input className="w-full bg-transparent text-sm outline-none" inputMode="numeric" placeholder="0"
              value={cashAmt} onChange={(e) => setCashAmt(e.target.value.replace(/\D/g, "").slice(0, 7))} />
          </div>
          <div className="text-sm text-slate-500">via UPI <span className="font-bold text-slate-700">{rupeeAmt(upiDue)}</span></div>
        </div>
      </>
    );
    footer = (
      <div className="space-y-2">
        <PrimaryButton disabled={upiDue <= 0} onClick={() => setShowQr(true)}><Icon.qr width={18} height={18} /> Show UPI QR{cashN > 0 ? ` — ${rupeeAmt(upiDue)}` : ""}</PrimaryButton>
        <GhostButton onClick={markCashFull}>Full Cash ({rupeeAmt(billTotal)})</GhostButton>
      </div>
    );

  /* ----------------------------- 10. Close ----------------------------- */
  } else if (st === "PAID") {
    body = (
      <>
        <Heading title="Payment received" sub={w.pending ? "Marked pending. Close the job." : "Customer notified. Close the job."} tone="ok" />
        <div className="mt-3 rounded-2xl border border-slate-200 p-3">
          <Row l="Amount" r={rupeeAmt(billTotal)} />
          <Row l="Mode" r={w.mode || "—"} muted />
          {w.split && Array.isArray(w.payments) && w.payments.map((p, i) => (
            <Row key={i} l={p.method} r={rupeeAmt(p.amount)} muted />
          ))}
        </div>
      </>
    );
    footer = <PrimaryButton onClick={() => advance("CLOSED", { nextService: "6 months" })}><Icon.checkCircle width={18} height={18} /> Close Job</PrimaryButton>;
  }

  return (
    <Shell job={job} nav={nav} onBack={() => { leaveJobScreen(); nav("/home"); }}>
      <main className="flex-1 overflow-y-auto px-4 pb-4">
        <ContextCards job={job} onPhotoClick={setPhotoPreview} />
        <div className="mt-4 animate-in">{body}</div>
      </main>
      {footer && <div className="safe-bottom sticky bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">{footer}</div>}

      {photoPreview && (
        <ImagePreview src={photoPreview} onClose={() => setPhotoPreview(null)} />
      )}

      {/* Start Travel confirmation */}
      {showTravel && (
        <Modal onClose={() => setShowTravel(false)}>
          <div className="text-center text-lg font-extrabold text-slate-800">Start travel?</div>
          <p className="mt-1 text-center text-sm text-slate-500">The customer will be notified that you're on the way to {job.name}.</p>
          <PrimaryButton className="mt-4 w-full" onClick={() => { setShowTravel(false); advance("ON_THE_WAY"); }}><Icon.truck width={18} height={18} /> Yes, Start Travel</PrimaryButton>
          <GhostButton className="mt-2 w-full" onClick={() => setShowTravel(false)}>Cancel</GhostButton>
        </Modal>
      )}

      {/* Show Customer — clean face-to-face estimate */}
      {showCust && (
        <Modal onClose={() => setShowCust(false)}>
          <div className="text-center text-lg font-extrabold text-slate-800">Estimate</div>
          <div className="mt-3 space-y-1">
            <Row l={chargeTypes.find((c) => c.id === charge)?.label} r={rupee(chargeAmt)} />
            {parts.map((p, i) => <Row key={i} l={p.name} r={rupeeAmt(p.price)} />)}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
            <span className="text-lg font-bold text-slate-800">Total</span>
            <span className="text-2xl font-extrabold text-brand">{rupeeAmt(estTotal || billTotal)}</span>
          </div>
          <GhostButton className="mt-4 w-full" onClick={() => setShowCust(false)}>Back</GhostButton>
        </Modal>
      )}

      {/* UPI QR — collect payment, then capture proof on customer's phone. */}
      {showQr && (
        <Modal onClose={closeQrModal}>
          <div className="text-center text-lg font-extrabold text-slate-800">Scan to pay {rupeeAmt(upiDue)}</div>
          {cashN > 0 && <div className="mt-1 text-center text-sm text-slate-500">Split: {rupeeAmt(cashN)} cash + {rupeeAmt(upiDue)} UPI</div>}
          <div className="mt-3"><UpiQr amount={upiDue} /></div>

          <SectionTitle required>Payment proof photo</SectionTitle>
          <p className="mt-1 text-xs text-slate-500">After the customer pays, take a photo of the payment success screen on their phone.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {upiProofUrl && (
              <button type="button" onClick={() => setPhotoPreview(upiProofUrl)} className="shrink-0">
                <img src={upiProofUrl} alt="UPI payment proof" className="h-20 w-20 rounded-lg border border-ok/30 object-cover" />
              </button>
            )}
            <button type="button" onClick={takePaymentProofPhoto} disabled={photoBusy}
              className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border-2 border-dashed border-brand/40 text-brand disabled:opacity-50">
              {photoBusy ? <span className="text-xs">…</span> : <Icon.camera width={24} height={24} />}
            </button>
          </div>

          <PrimaryButton
            className="mt-4 w-full !bg-ok"
            disabled={!upiProofUrl || photoBusy}
            onClick={() => { closeQrModal(); markUpiPaid(); }}
          >
            <Icon.check width={18} height={18} /> Mark {cashN > 0 ? "Split" : "UPI"} Paid
          </PrimaryButton>
          <GhostButton className="mt-2 w-full" onClick={closeQrModal}>Cancel</GhostButton>
        </Modal>
      )}
    </Shell>
  );
}

/* ------------------------------ Sub-components ----------------------------- */
function Shell({ job, nav, onBack, children }) {
  const stepIdx = job.status === "CLOSED" ? STEPS.length : stepIndexForStatus(job.status);
  const goBack = onBack || (() => nav("/home"));
  return (
    <div className="safe-x flex min-h-screen flex-col bg-slate-100">
      <header className="safe-top sticky top-0 z-10 bg-white px-3 pb-2 pt-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={goBack} className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Icon.back /></button>
          <div className="flex-1 px-2 min-w-0">
            <div className="truncate font-bold text-slate-800">{job.name}</div>
            <div className="truncate text-xs text-slate-400">{job.code} • {job.model}</div>
          </div>
          <StatusPill status={job.status} />
        </div>
        <div className="mt-2.5">
          <Stepper currentIndex={Math.min(stepIdx, STEPS.length)} />
        </div>
      </header>
      {children}
    </div>
  );
}

const Heading = ({ title, sub, tone }) => (
  <>
    <h2 className={cx("text-xl font-extrabold", tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-slate-800")}>{title}</h2>
    <p className="text-slate-500">{sub}</p>
  </>
);

function Modal({ children, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 z-40 mx-auto max-w-sm -translate-y-1/2 rounded-2xl bg-white p-5 shadow-pop">{children}</div>
    </>
  );
}

function ContextCards({ job, onPhotoClick }) {
  // Call/Map card is for getting to the customer — hide it once the technician
  // has reached (any status past ON_THE_WAY).
  const beforeArrival = job.status === "NEW" || job.status === "ON_THE_WAY";
  return (
    <>
      {beforeArrival && (
      <Card className="mt-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-bold text-slate-800">{job.name}</div>
            <div className="mt-0.5 flex items-start gap-1 text-sm text-slate-500"><Icon.pin width={14} height={14} className="mt-0.5" /> {job.address}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-slate-400">Visit charge</div>
            <div className={cx("text-sm font-bold", job.visitCharge === 0 ? "text-ok" : "text-slate-700")}>{rupee(job.visitCharge)}</div>
          </div>
        </div>
        {job.tags?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{job.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <GhostButton onClick={() => callPhone(job.phone)} disabled={!job.phone}><Icon.phone width={16} height={16} /> Call</GhostButton>
          <GhostButton className="!border-[#25D366]/40 !text-[#1DA851]" onClick={() => openWhatsApp(job.phone)} disabled={!job.phone}><Icon.whatsapp width={16} height={16} /> WhatsApp</GhostButton>
          <GhostButton className="!border-ok/30 !text-ok" onClick={() => openMaps(job.address)} disabled={!job.address}><Icon.map width={16} height={16} /> Map</GhostButton>
        </div>
      </Card>
      )}

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><Icon.wrench width={15} height={15} /> Issue &amp; Purifier</div>
        <div className="mt-1 text-[15px] text-slate-800">{job.issue}</div>
        <div className="text-sm text-slate-500">{job.model}</div>
      </div>

      {job.notes ? (
        <div className="mt-3 rounded-2xl border border-warn/30 bg-warn-light p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-warn"><Icon.spark width={15} height={15} /> Customer notes</div>
          <div className="mt-1 whitespace-pre-wrap text-[15px] text-slate-800">{job.notes}</div>
        </div>
      ) : null}

      {job.customerPhotos?.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><Icon.camera width={15} height={15} /> Customer photos</div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {job.customerPhotos.map((cid) => (
              <button key={cid} type="button" onClick={() => onPhotoClick?.(mediaUrl(cid))} className="shrink-0">
                <img src={mediaUrl(cid)} alt="Customer purifier" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const numOnly = (v, max = 5) => v.replace(/\D/g, "").slice(0, max);

function TdsSingle({ value, onChange, placeholder = "40", label = "Filter output" }) {
  return (
    <div className="mt-2 rounded-xl border border-brand/20 bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="text-xs font-semibold text-brand-dark">{label}</div>
      <input
        className={cx(input, "mt-2 !border-0 !bg-transparent !p-0 text-center text-3xl font-extrabold text-brand !shadow-none !ring-0")}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(numOnly(e.target.value))}
      />
      <div className="text-center text-[10px] text-slate-400">ppm</div>
    </div>
  );
}

function TdsPair({ tap, filter, onTap, onFilter, tapPh = "450", filterPh = "40" }) {
  const tapN = Number(tap);
  const filterN = Number(filter);
  const drop = tapN > 0 && filterN >= 0 && tap && filter ? Math.round((1 - filterN / tapN) * 100) : null;

  return (
    <>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
          <div className="text-xs font-semibold text-slate-500">Tap water</div>
          <input
            className={cx(input, "mt-2 !border-0 !bg-transparent !p-0 text-center text-2xl font-extrabold !shadow-none !ring-0")}
            inputMode="numeric"
            placeholder={tapPh}
            value={tap}
            onChange={(e) => onTap(numOnly(e.target.value))}
          />
          <div className="text-center text-[10px] text-slate-400">ppm</div>
        </div>
        <div className="rounded-xl border border-brand/20 bg-gradient-to-br from-brand-50 to-white p-3">
          <div className="text-xs font-semibold text-brand-dark">Filter output</div>
          <input
            className={cx(input, "mt-2 !border-0 !bg-transparent !p-0 text-center text-2xl font-extrabold text-brand !shadow-none !ring-0")}
            inputMode="numeric"
            placeholder={filterPh}
            value={filter}
            onChange={(e) => onFilter(numOnly(e.target.value))}
          />
          <div className="text-center text-[10px] text-slate-400">ppm</div>
        </div>
      </div>
      {drop != null && drop >= 0 && (
        <div className="mt-1.5 text-center text-xs font-medium text-ok">
          {drop}% reduction in TDS
        </div>
      )}
    </>
  );
}

function ImagePreview({ src, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/90" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex items-center justify-center">
        <img src={src} alt="Preview" className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-xl text-white"
      >
        ×
      </button>
    </>
  );
}
