import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { queuedNewCall } from "../lib/sync.js";
import { Icon, Card, FLabel, PrimaryButton, MDialog, MDialogBtn, input, cx } from "../components/ui.jsx";

/* "New Call" (mockup j_addcall): the technician adds a walk-in / direct
   customer from the field. Creating the ticket needs the server — this screen
   is online-only and says so instead of silently failing. */

const AREAS = ["Wakad", "Pimple Saudagar", "Hinjewadi", "Akurdi", "Nigdi", "Chinchwad", "Pimpri", "Other"];
const PROBLEMS = [
  ["No Water", "drop"], ["Low Water", "drop"], ["Leak", "drop"],
  ["Bad Taste", "sad"], ["Pump", "gear"], ["Filter", "filter"],
];

export default function NewCall() {
  const nav = useNavigate();
  const { addJob, live } = useJobs();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState(null);
  const [prob, setProb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [added, setAdded] = useState(false);
  const [queued, setQueued] = useState(false); // saved on the phone, not sent yet

  /* The mobile number is required, and the screen enforces it rather than
     letting the server refuse the call.

     It is not a form-tidiness rule. The customer's number IS their identity on
     this platform: every confirmation, the arrival code, the bill and the rating
     ask all go to it over WhatsApp. A call recorded without one can be worked
     but never spoken to. It also could not be saved at all — customers.phone is
     NOT NULL, so a blank number came back as a bare "Something went wrong" with
     nothing on the screen to say which field was at fault. */
  const phoneOk = /^[6-9]\d{9}$/.test(phone);
  const ready = area && prob && phoneOk;

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      // Parked on the phone when there is no signal and sent the moment there
      // is. New work is usually found in the basements and stairwells where the
      // signal is worst, so refusing it there lost the job, not just the status.
      const res = await queuedNewCall({ name: name.trim(), phone: phone.trim(), area, problem: prob[0] });
      if (res?.job) addJob(res.job);
      setQueued(!!res?.queued);
      setAdded(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const Chip = ({ on, onClick, icon: CIc, children }) => (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx(
        "flex min-h-[48px] items-center gap-2 rounded-full border px-3.5 text-[15px] font-semibold transition active:scale-[0.97]",
        on ? "border-transparent bg-brand-tint text-brand-dark" : "border-hair bg-transparent text-strong"
      )}>
      {CIc && <CIc width={16} height={16} className={on ? "text-brand-dark" : "text-muted"} />}
      {children}
    </button>
  );

  return (
    <div className="safe-x safe-top mx-auto flex h-screen w-full max-w-[440px] flex-col overflow-hidden bg-sunken">
      <div className="flex items-center gap-2 px-3 pb-2 pt-2">
        <button type="button" onClick={() => nav("/home")}
          className="flex min-h-[44px] items-center gap-0.5 px-1.5 text-[17px] font-medium text-brand">
          <Icon.back width={20} height={20} /> Cancel
        </button>
        <div className="min-w-0 flex-1 pr-[76px] text-center">
          <div className="text-[16px] font-bold text-strong">New Call</div>
          <div className="text-xs text-subtle">Add a direct customer call</div>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <Card className="mt-1">
          <FLabel icon={Icon.person}>Customer Name</FLabel>
          <input className={input} placeholder="Type name" value={name} onChange={(e) => setName(e.target.value)} />
        </Card>
        <Card className="mt-3">
          <FLabel icon={Icon.phone} must>Mobile Number</FLabel>
          <div className="flex gap-2.5">
            <div className="grid w-[64px] place-items-center rounded-t-lg border-b-2 border-subtle bg-tonal text-[16px] font-bold text-muted">+91</div>
            <input className={cx(input, "flex-1")} inputMode="numeric" type="tel" autoComplete="tel-national"
              placeholder="Mobile number" maxLength={10} value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </div>
          {/* Says what is missing while it is being typed, rather than waiting
              for a tap on a button that is disabled for reasons unexplained. */}
          <p className="mt-2 text-[12.5px] text-subtle">
            {phone.length === 0
              ? "Needed — the customer gets their updates, bill and arrival code on WhatsApp."
              : phoneOk ? "Looks right."
              : phone.length < 10 ? `${10 - phone.length} more digit${phone.length === 9 ? "" : "s"}`
              : "An Indian mobile number starts with 6, 7, 8 or 9."}
          </p>
        </Card>
        <div className="mx-1 mb-2 mt-5 text-[12.5px] font-semibold uppercase tracking-wide text-muted">Area</div>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <Chip key={a} on={area === a} icon={Icon.pin} onClick={() => setArea(a)}>{a}</Chip>
          ))}
        </div>
        <div className="mx-1 mb-2 mt-5 text-[12.5px] font-semibold uppercase tracking-wide text-muted">Problem</div>
        <div className="flex flex-wrap gap-2">
          {PROBLEMS.map((p) => (
            <Chip key={p[0]} on={prob?.[0] === p[0]} icon={Icon[p[1]]} onClick={() => setProb(p)}>{p[0]}</Chip>
          ))}
        </div>
        {err && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl bg-danger-tint p-3.5 text-[14.5px] font-medium text-danger-fg">
            <Icon.alert width={18} height={18} className="mt-0.5 shrink-0" /> {err}
          </div>
        )}
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-brand-tint p-3.5 text-[14.5px] font-medium text-brand-dark">
          <Icon.alert width={18} height={18} className="shrink-0" /> Office will be notified when you add this call.
        </div>
      </main>

      <div className="bg-gradient-to-t from-sunken via-sunken/95 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
        <PrimaryButton className="!bg-ok" disabled={!ready || busy} loading={busy} onClick={submit}>
          <Icon.plus width={20} height={20} /> Add Call
        </PrimaryButton>
      </div>

      {added && (
        <MDialog title={queued ? "Call saved" : "Call Added"}
          icon={<Icon.check width={24} height={24} className="text-ok-fg" />} iconClass="bg-ok-tint"
          onClose={() => nav("/home")}
          actions={<MDialogBtn bold onClick={() => nav("/home")}>Done</MDialogBtn>}>
          {queued
            ? <>Saved on your phone. It will reach the office by itself once you have signal &mdash; you don't need to add it again.</>
            : <>Office has been notified. It is now in <b>Today</b>.</>}
        </MDialog>
      )}
    </div>
  );
}
