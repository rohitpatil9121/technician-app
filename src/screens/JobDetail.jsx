import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { chargeTypes } from "../data/mock.js";
import { stepIndexForStatus } from "../lib/workflow.js";
import { rupee, rupeeAmt } from "../lib/format.js";
import { callPhone, openMaps } from "../lib/contact.js";
import {
  Icon, Tag, StatusPill, Stepper, Card, PrimaryButton, GhostButton,
  Field, input, cx,
} from "../components/ui.jsx";

/* Small reusable bits */
const InfoBox = ({ title, items, tone = "brand" }) => (
  <div className={cx("rounded-xl p-3 text-sm", tone === "warn" ? "bg-warn-light" : "bg-brand-50")}>
    <div className={cx("mb-1 font-semibold", tone === "warn" ? "text-warn" : "text-brand-dark")}>{title}</div>
    <ul className="space-y-0.5 text-slate-600">
      {items.map((t) => <li key={t} className="flex gap-1.5"><span>•</span>{t}</li>)}
    </ul>
  </div>
);

const SectionTitle = ({ children, required }) => (
  <div className="mt-4 text-sm font-bold text-slate-700">
    {children} {required && <span className="text-danger">REQUIRED</span>}
  </div>
);

export default function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getJob, updateJob, parts: partsCatalog } = useJobs();
  const job = getJob(id);

  /* ---- form state (all steps) ---- */
  const w = job?.work || {};
  const [tdsIn, setTdsIn] = useState(w.tdsIn || "");
  const [tdsOut, setTdsOut] = useState(w.tdsOut || "");
  const [parts, setParts] = useState(w.parts || []);
  const [pick, setPick] = useState("");
  const [note, setNote] = useState(w.note || "");
  const [charge, setCharge] = useState(w.charge || (job?.visitCharge === 0 ? "warranty" : "visit"));
  const [tdsFinal, setTdsFinal] = useState(w.tdsFinal || "");
  const [payments, setPayments] = useState(w.payments || []);
  const [payMethod, setPayMethod] = useState("UPI");
  const [payAmt, setPayAmt] = useState("");
  const [nextService, setNextService] = useState("6 months");
  const [lead, setLead] = useState(false);

  if (!job) return <div className="p-6">Job not found.</div>;

  const rejected = job.status === "REJECTED";
  const step = stepIndexForStatus(job.status);

  const chargeAmt = chargeTypes.find((c) => c.id === charge)?.amount ?? 0;
  const partsTotal = parts.reduce((s, p) => s + Number(p.price || 0), 0);
  const total = rejected ? job.visitCharge : chargeAmt + partsTotal;
  const collected = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = Math.max(0, total - collected);

  const advance = (status, work) => updateJob(job.id, { status, work });

  const addPart = () => {
    const p = partsCatalog.find((x) => x.id === pick);
    if (p) setParts((prev) => [...prev, { ...p }]);
    setPick("");
  };
  const setPartPrice = (i, val) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, price: val } : p)));
  const addPayment = () => {
    const amt = Number(payAmt);
    if (amt > 0) setPayments((prev) => [...prev, { method: payMethod, amount: Math.min(amt, remaining) }]);
    setPayAmt("");
  };

  /* ----------------------------- CLOSED screen ----------------------------- */
  if (job.status === "CLOSED") {
    return (
      <div className="flex min-h-screen flex-col">
        <DetailHeader job={job} nav={nav} step={3} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-ok-light text-ok">
            <Icon.checkCircle width={40} height={40} />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-800">Job Closed Successfully</h2>
          <p className="text-slate-500">{job.name} • {job.area}</p>
          <div className="mt-5 w-full rounded-2xl border border-ok/20 bg-ok-light p-3 text-left">
            <div className="flex items-center gap-1.5 font-semibold text-ok">
              <Icon.spark width={16} height={16} /> Incentive impact
            </div>
            <div className="text-sm text-slate-600">
              Good rating + no repeat complaint can increase your incentive this week.
            </div>
          </div>
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <GhostButton onClick={() => nav("/home")}>Back to Jobs</GhostButton>
            <PrimaryButton className="!py-3" onClick={() => nav("/reviews")}>My Reviews</PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------- Step bodies ------------------------------ */
  let body = null;
  let footer = null;

  /* ---- Step 0: Accept ---- */
  if (step === 0) {
    body = (
      <>
        <h2 className="text-xl font-extrabold text-slate-800">New job assigned</h2>
        <p className="text-slate-500">Review and accept to start work.</p>
        <div className="mt-3"><InfoBox title="On accept, the system will:" items={["Notify the customer", "Mark the job in progress", "Log the timestamp"]} /></div>
      </>
    );
    footer = (
      <div className="grid grid-cols-[1fr_1.6fr] gap-2">
        <GhostButton onClick={() => nav("/home")}>✕ Reject</GhostButton>
        <PrimaryButton onClick={() => advance("ACCEPTED")}><Icon.check width={18} height={18} /> Accept Job</PrimaryButton>
      </div>
    );

  /* ---- Step 1: Diagnose + Estimate (one screen) ---- */
  } else if (step === 1) {
    body = (
      <>
        <h2 className="text-xl font-extrabold text-slate-800">Diagnose &amp; estimate</h2>
        <p className="text-slate-500">Note the problem, add parts, set the price.</p>

        <SectionTitle>TDS readings</SectionTitle>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="Input TDS"><input className={input} inputMode="numeric" placeholder="e.g. 450" value={tdsIn} onChange={(e) => setTdsIn(e.target.value)} /></Field>
          <Field label="Output TDS"><input className={input} inputMode="numeric" placeholder="e.g. 80" value={tdsOut} onChange={(e) => setTdsOut(e.target.value)} /></Field>
        </div>

        <SectionTitle>Parts required</SectionTitle>
        <div className="mt-2 flex gap-2">
          <select className={cx(input, "flex-1")} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select a part to add</option>
            {partsCatalog.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={addPart} disabled={!pick} className="rounded-xl bg-brand-100 px-4 font-semibold text-brand-dark disabled:opacity-50">+ Add</button>
        </div>
        {parts.length === 0 ? (
          <div className="mt-2 text-sm text-slate-400">No parts added yet.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                <span className="text-sm">{p.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">₹</span>
                  <input className="w-20 rounded-lg bg-slate-100 px-2 py-1 text-right text-sm" inputMode="numeric"
                    value={p.price} onChange={(e) => setPartPrice(i, e.target.value)} />
                  <button onClick={() => setParts(parts.filter((_, idx) => idx !== i))} className="text-slate-400"><Icon.trash width={16} height={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>Technician note</SectionTitle>
        <textarea className={cx(input, "mt-2")} rows={2} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />

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

        <div className="mt-4 rounded-2xl border border-slate-200 p-3">
          <div className="font-bold text-slate-800">Bill summary</div>
          <Row l={chargeTypes.find((c) => c.id === charge)?.label} r={rupee(chargeAmt)} />
          {parts.map((p, i) => <Row key={i} l={p.name} r={rupeeAmt(p.price)} muted />)}
          {parts.length > 0 && <Row l="Parts total" r={rupeeAmt(partsTotal)} bold />}
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
            <span className="font-bold text-slate-800">Grand total</span>
            <span className="text-lg font-extrabold text-brand">{rupeeAmt(chargeAmt + partsTotal)}</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400">Sends the estimate to the customer on WhatsApp for approval.</div>
      </>
    );
    footer = (
      <PrimaryButton
        disabled={!charge}
        onClick={() => advance("ESTIMATE_SENT", {
          tdsIn, tdsOut, parts, note, charge,
          total: chargeAmt + partsTotal,
        })}
      >
        Send Estimate for Approval
      </PrimaryButton>
    );

  /* ---- Step 2: Payment & Close (approval → finalize) ---- */
  } else if (step === 2) {
    /* Phase A — waiting for the customer's approval of the sent estimate */
    if (job.status === "ESTIMATE_SENT") {
      body = (
        <>
          <h2 className="text-xl font-extrabold text-slate-800">Customer approval</h2>
          <p className="text-slate-500">The estimate was sent on WhatsApp. Mark the customer's response.</p>
          <div className="mt-3 rounded-2xl border border-slate-200 p-3">
            <div className="font-bold text-slate-800">Estimate summary</div>
            <div className="text-sm text-slate-600">Charge: {chargeTypes.find((c) => c.id === charge)?.label}</div>
            {parts.length > 0 && <div className="text-sm text-slate-600">Parts: {parts.map((p) => p.name).join(", ")}</div>}
            <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="font-semibold">Total</span><span className="font-extrabold text-brand">{rupeeAmt(chargeAmt + partsTotal)}</span>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">If rejected, collect the visit charge only and close.</div>
        </>
      );
      footer = (
        <div className="grid grid-cols-2 gap-2">
          <GhostButton className="!border-danger/30 !text-danger" onClick={() => advance("REJECTED")}>✕ Rejected</GhostButton>
          <PrimaryButton className="!bg-ok" onClick={() => advance("VERIFIED")}><Icon.check width={18} height={18} /> Approved</PrimaryButton>
        </div>
      );

    /* Phase B — proof of work, collect payment, close (one screen) */
    } else {
      // Close only needs the bill to be fully collected — TDS and photos are
      // optional now (no required proof fields).
      const canClose = remaining === 0;
      body = (
        <>
          <h2 className="text-xl font-extrabold text-slate-800">Payment &amp; close</h2>
          <p className="text-slate-500">Collect payment, then close the job.</p>
          {rejected && <div className="mt-2 rounded-xl bg-warn-light p-2 text-sm text-warn">Estimate rejected — collecting visit charge only.</div>}

          {!rejected && (
            <>
              <SectionTitle>Final output TDS</SectionTitle>
              <input className={cx(input, "mt-2")} inputMode="numeric" placeholder={`Pre-repair output was ${tdsOut || "—"}`} value={tdsFinal} onChange={(e) => setTdsFinal(e.target.value)} />
            </>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 p-3">
            {!rejected && <Row l={chargeTypes.find((c) => c.id === charge)?.label} r={rupee(chargeAmt)} />}
            {!rejected && parts.length > 0 && <Row l="Parts" r={rupeeAmt(partsTotal)} />}
            {rejected && <Row l="Visit charge" r={rupeeAmt(total)} />}
            <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="font-bold text-slate-800">Total bill</span><span className="text-lg font-extrabold text-brand">{rupeeAmt(total)}</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-ok-light p-3"><div className="text-xs text-slate-500">Collected</div><div className="text-xl font-extrabold text-ok">{rupeeAmt(collected)}</div></div>
            <div className="rounded-xl bg-warn-light p-3"><div className="text-xs text-slate-500">Remaining</div><div className="text-xl font-extrabold text-warn">{rupeeAmt(remaining)}</div></div>
          </div>

          {remaining > 0 && (
            <>
              <SectionTitle>Add payment</SectionTitle>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {["UPI", "Cash", "Credit Card"].map((m) => (
                  <button key={m} onClick={() => setPayMethod(m)} className={cx("rounded-xl border py-3 text-sm font-medium", payMethod === m ? "border-brand bg-brand-50 text-brand-dark" : "border-slate-200 text-slate-600")}>{m}</button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input className={cx(input, "flex-1")} inputMode="numeric" placeholder={`Up to ${rupeeAmt(remaining)}`} value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
                <button onClick={addPayment} disabled={!payAmt} className="rounded-xl bg-brand-100 px-4 font-semibold text-brand-dark disabled:opacity-50">+ Add</button>
              </div>
            </>
          )}

          {payments.length > 0 && (
            <div className="mt-3 space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <span>{p.method}</span>
                  <div className="flex items-center gap-2"><span className="font-semibold">{rupeeAmt(p.amount)}</span>
                    <button onClick={() => setPayments(payments.filter((_, idx) => idx !== i))} className="text-slate-400"><Icon.trash width={15} height={15} /></button>
                  </div>
                </div>
              ))}
              {remaining === 0 && <div className="flex items-center gap-1.5 text-sm text-ok"><Icon.check width={15} height={15} /> Bill fully collected.</div>}
            </div>
          )}

          <SectionTitle>Next service reminder</SectionTitle>
          <select className={cx(input, "mt-2")} value={nextService} onChange={(e) => setNextService(e.target.value)}>
            <option>3 months</option><option>6 months</option><option>12 months</option>
          </select>

          <button onClick={() => setLead((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-2xl border border-ok/20 bg-ok-light p-3 text-left">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-ok"><Icon.spark width={16} height={16} /> Create a lead?</div>
              <div className="text-sm text-slate-600">Customer wants a new purifier or special part? Manager will follow up.</div>
            </div>
            <span className={cx("rounded-full px-3 py-1 text-xs font-bold", lead ? "bg-ok text-white" : "bg-white text-slate-400")}>{lead ? "Yes" : "No"}</span>
          </button>
        </>
      );
      footer = (
        <PrimaryButton
          disabled={!canClose}
          onClick={() => advance("CLOSED", { tdsFinal, payments, total, nextService, lead })}
        >
          <Icon.checkCircle width={18} height={18} /> Collect Payment &amp; Close
        </PrimaryButton>
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DetailHeader job={job} nav={nav} step={step} />
      <main className="flex-1 overflow-y-auto px-4 pb-4">
        <ContextCards job={job} />
        <div className="mt-4 animate-in">{body}</div>
      </main>
      {footer && <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">{footer}</div>}
    </div>
  );
}

/* ------------------------------ Sub-components ----------------------------- */
function DetailHeader({ job, nav, step }) {
  return (
    <header className="sticky top-0 z-10 bg-white px-3 pb-2 pt-3 shadow-sm">
      <div className="flex items-center justify-between">
        <button onClick={() => nav("/home")} className="grid h-9 w-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100"><Icon.back /></button>
        <div className="flex-1 px-2">
          <div className="font-bold text-slate-800">{job.name}</div>
          <div className="text-xs text-slate-400">{job.code || job.id} • {job.model}</div>
        </div>
        <StatusPill status={job.status} />
      </div>
      <div className="mt-2"><Stepper currentIndex={step} /></div>
    </header>
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
          <GhostButton className="!border-ok/30 !text-ok" onClick={() => openMaps(job.address)} disabled={!job.address}><Icon.map width={16} height={16} /> Open Maps</GhostButton>
        </div>
      </Card>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-brand-dark"><Icon.wrench width={15} height={15} /> Issue &amp; Purifier</div>
        <div className="mt-1 text-[15px] text-slate-800">{job.issue}</div>
        <div className="text-sm text-slate-500">{job.model}</div>
        <div className="text-xs text-slate-400">Last service: {job.lastService}</div>
      </div>

      {job.notes ? (
        <div className="mt-3 rounded-2xl border border-warn/30 bg-warn-light p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-warn"><Icon.spark width={15} height={15} /> Customer notes</div>
          <div className="mt-1 whitespace-pre-wrap text-[15px] text-slate-800">{job.notes}</div>
        </div>
      ) : null}
    </>
  );
}

const Row = ({ l, r, bold, muted }) => (
  <div className={cx("flex items-center justify-between py-0.5", muted ? "text-sm text-slate-500" : "text-slate-700", bold && "font-bold")}>
    <span>{l}</span><span>{r}</span>
  </div>
);
