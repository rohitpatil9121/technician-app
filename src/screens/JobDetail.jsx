import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { chargeTypes } from "../data/mock.js";
import { rupee, rupeeAmt } from "../lib/format.js";
import { api, mediaUrl } from "../lib/api.js";
import { callPhone, openMaps } from "../lib/contact.js";
import { takePhoto } from "../lib/camera.js";
import UpiQr from "../components/UpiQr.jsx";
import {
  Icon, Tag, StatusPill, Card, PrimaryButton, GhostButton, input, cx,
} from "../components/ui.jsx";

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
  const nav = useNavigate();
  const { getJob, updateJob, setJob, parts: partsCatalog } = useJobs();
  const job = getJob(id);
  const w = job?.work || {};

  /* editable state (seeded from saved work) */
  const [problems, setProblems] = useState(w.problems || []);
  const [diagNote, setDiagNote] = useState(w.diagNote || "");
  const [parts, setParts] = useState(w.parts || []);
  const [charge, setCharge] = useState(w.charge || (job?.visitCharge === 0 ? "warranty" : "service"));
  const [partBrand, setPartBrand] = useState("");
  const [partSearch, setPartSearch] = useState("");
  /* arrival OTP */
  const [otpSent, setOtpSent] = useState(false);
  const [arrCode, setArrCode] = useState("");
  const [arrErr, setArrErr] = useState("");
  const [busy, setBusy] = useState(false);
  /* modals */
  const [showCust, setShowCust] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  if (!job) return <div className="p-6">Job not found.</div>;

  const st = job.status;
  const chargeAmt = chargeTypes.find((c) => c.id === charge)?.amount ?? 0;
  const partsTotal = parts.reduce((s, p) => s + Number(p.price || 0), 0);
  const estTotal = chargeAmt + partsTotal;
  const billTotal = Number(w.total ?? estTotal);

  const advance = (status, work) => updateJob(job.id, { status, work });
  const toggleProblem = (p) => setProblems((a) => (a.includes(p) ? a.filter((x) => x !== p) : [...a, p]));
  const addPartObj = (p) => setParts((prev) => [...prev, { ...p }]);
  const setPartPrice = (i, val) => setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, price: val } : p)));
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
  const markPaid = (mode) => advance("PAID", { payments: [{ method: mode, amount: billTotal }], total: billTotal, mode });

  const takeJobPhoto = async () => {
    setPhotoBusy(true);
    try {
      const dataUrl = await takePhoto();
      const res = await api.uploadPhoto(job.id, dataUrl);
      if (res.ok) setJob(res.job);
    } catch { /* cancelled or unavailable */ }
    finally { setPhotoBusy(false); }
  };
  const techPhotos = w.tech_photos || [];

  /* ------------------------------ CLOSED ------------------------------ */
  if (st === "CLOSED") {
    return (
      <Shell job={job} nav={nav}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-ok-light text-ok"><Icon.checkCircle width={40} height={40} /></div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-800">Job Closed</h2>
          <p className="text-slate-500">{job.name} • {job.area}</p>
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
    footer = <PrimaryButton onClick={() => advance("ON_THE_WAY")}><Icon.truck width={18} height={18} /> Start Travel</PrimaryButton>;

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
        <Heading title="Diagnosis" sub="Select the problem, take a photo, then estimate." />
        <SectionTitle required>Select problem</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {PROBLEMS.map((p) => (
            <button key={p} onClick={() => toggleProblem(p)}
              className={cx("rounded-full border px-3 py-1.5 text-sm", problems.includes(p) ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600")}>{p}</button>
          ))}
        </div>
        <SectionTitle>Note</SectionTitle>
        <textarea className={cx(input, "mt-2")} rows={2} placeholder="Optional details" value={diagNote} onChange={(e) => setDiagNote(e.target.value)} />

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
      <div className="space-y-2">
        <PrimaryButton disabled={problems.length === 0} onClick={() => advance("DIAGNOSED", { problems, diagNote })}>Continue to Estimate</PrimaryButton>
        <GhostButton className="!border-danger/30 !text-danger" onClick={() => advance("WORK_DONE", { charge: "visit", total: 250, visitOnly: true })}>Cannot fix today — Visit charge only</GhostButton>
      </div>
    );

  /* ----------------------------- 4-5. Create Estimate ----------------------------- */
  } else if (st === "DIAGNOSED") {
    body = (
      <>
        <Heading title="Create estimate" sub="Set the charge and add parts." />
        <SectionTitle>Charge type</SectionTitle>
        <div className="mt-2 space-y-2">
          {chargeTypes.map((c) => (
            <button key={c.id} onClick={() => setCharge(c.id)}
              className={cx("flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left", charge === c.id ? "border-brand bg-brand-50" : "border-slate-200")}>
              <span className="text-sm font-medium text-slate-700">{c.label}</span>
              <span className={cx("text-sm font-bold", c.amount === 0 ? "text-ok" : "text-slate-700")}>{rupee(c.amount)}</span>
            </button>
          ))}
        </div>

        <SectionTitle>Parts</SectionTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {BRANDS.map((b) => (
            <button key={b.id} onClick={() => setPartBrand(partBrand === b.id ? "" : b.id)}
              className={cx("rounded-full border px-3 py-1.5 text-sm", partBrand === b.id ? "border-brand bg-brand text-white" : "border-slate-200 text-slate-600")}>{b.label}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 px-3">
          <Icon.search width={16} height={16} className="text-slate-400" />
          <input className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Search part…" value={partSearch} onChange={(e) => setPartSearch(e.target.value)} />
        </div>
        {(partBrand || partSearch) && (
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
        {parts.length > 0 && (
          <div className="mt-2 space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <span className="text-sm">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">₹</span>
                  <input className="w-20 rounded-lg bg-slate-100 px-2 py-1 text-right text-sm" inputMode="numeric" value={p.price} onChange={(e) => setPartPrice(i, e.target.value)} />
                  <button onClick={() => setParts(parts.filter((_, idx) => idx !== i))} className="text-slate-400"><Icon.trash width={16} height={16} /></button>
                </div>
              </div>
            ))}
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
        <PrimaryButton onClick={() => advance("ESTIMATE_SENT", { parts, charge, problems, diagNote, total: estTotal })}>Send Estimate</PrimaryButton>
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
          <Icon.clock width={16} height={16} /> This screen updates automatically when the customer replies.
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
      body = <Heading title="Work in progress" sub="Tap Work Done when finished." />;
      footer = <PrimaryButton onClick={() => advance("WORK_DONE", { total: billTotal })}><Icon.checkCircle width={18} height={18} /> Work Done</PrimaryButton>;
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
        <Heading title="Collect payment" sub="Show the UPI QR or mark cash." />
        {w.visitOnly && <div className="mt-2 rounded-xl bg-warn-light p-2 text-sm text-warn">Visit charge only — estimate not approved.</div>}
        <div className="mt-3 rounded-2xl border border-slate-200 p-3 text-center">
          <div className="text-xs uppercase text-slate-400">Amount due</div>
          <div className="text-3xl font-extrabold text-brand">{rupeeAmt(billTotal)}</div>
        </div>
      </>
    );
    footer = (
      <div className="space-y-2">
        <PrimaryButton onClick={() => setShowQr(true)}><Icon.qr width={18} height={18} /> Show UPI QR</PrimaryButton>
        <div className="grid grid-cols-2 gap-2">
          <GhostButton onClick={() => markPaid("Cash")}>Cash Collected</GhostButton>
          <GhostButton onClick={() => advance("PAID", { mode: "Pending", pending: true, total: billTotal })}>Payment Pending</GhostButton>
        </div>
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
        </div>
      </>
    );
    footer = <PrimaryButton onClick={() => advance("CLOSED", { nextService: "6 months" })}><Icon.checkCircle width={18} height={18} /> Close Job</PrimaryButton>;
  }

  return (
    <Shell job={job} nav={nav}>
      <main className="flex-1 overflow-y-auto px-4 pb-4">
        <ContextCards job={job} />
        <div className="mt-4 animate-in">{body}</div>
      </main>
      {footer && <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">{footer}</div>}

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

      {/* UPI QR */}
      {showQr && (
        <Modal onClose={() => setShowQr(false)}>
          <div className="text-center text-lg font-extrabold text-slate-800">Scan to pay {rupeeAmt(billTotal)}</div>
          <div className="mt-3"><UpiQr amount={billTotal} /></div>
          <PrimaryButton className="mt-4 w-full !bg-ok" onClick={() => { setShowQr(false); markPaid("UPI"); }}><Icon.check width={18} height={18} /> Mark UPI Paid</PrimaryButton>
          <GhostButton className="mt-2 w-full" onClick={() => setShowQr(false)}>Cancel</GhostButton>
        </Modal>
      )}
    </Shell>
  );
}

/* ------------------------------ Sub-components ----------------------------- */
function Shell({ job, nav, children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 bg-white px-3 pb-2 pt-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button onClick={() => nav("/home")} className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Icon.back /></button>
          <div className="flex-1 px-2">
            <div className="font-bold text-slate-800">{job.name}</div>
            <div className="text-xs text-slate-400">{job.code || job.id} • {job.model}</div>
          </div>
          <StatusPill status={job.status} />
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

function ContextCards({ job }) {
  return (
    <>
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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <GhostButton onClick={() => callPhone(job.phone)} disabled={!job.phone}><Icon.phone width={16} height={16} /> Call Customer</GhostButton>
          <GhostButton className="!border-ok/30 !text-ok" onClick={() => openMaps(job.address)} disabled={!job.address}><Icon.map width={16} height={16} /> Map</GhostButton>
        </div>
      </Card>

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
              <a key={cid} href={mediaUrl(cid)} target="_blank" rel="noreferrer" className="shrink-0">
                <img src={mediaUrl(cid)} alt="Customer purifier" className="h-24 w-24 rounded-lg border border-slate-200 object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
