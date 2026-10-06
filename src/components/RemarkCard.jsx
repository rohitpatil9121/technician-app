import { useState } from "react";
import { useJobs } from "../store/JobsContext.jsx";
import { queuedRemark } from "../lib/sync.js";
import { Card, FLabel, GhostButton, Icon, input, cx } from "./ui.jsx";

/* The technician's remark on a job, for the office: what he found, what the
   customer said, what to bring next time. His words to the office — the amber
   Notes box is the office's words to him. Saved on its own, so it can be
   written before the visit, during it or after the job is closed, and it is
   parked on the phone when there is no signal like every other write. */
export default function RemarkCard({ job, className }) {
  const { setJob } = useJobs();
  const saved = job.work?.remark || "";
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const dirty = text.trim() !== saved.trim();

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await queuedRemark(job.id, text.trim());
      if (res?.job) setJob(res.job);
      else setJob({ ...job, work: { ...job.work, remark: text.trim() } });
      setMsg(res?.queued ? "Saved on your phone — it will reach the office when you have signal." : "Saved. The office can see it.");
    } catch (e) {
      setMsg(e.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cx("mt-3", className)}>
      <FLabel icon={Icon.person}>Your remark for office</FLabel>
      <textarea className={cx(input, "min-h-[88px] w-full resize-none py-3 leading-relaxed")} rows={3} maxLength={1000}
        placeholder="Anything the office should know about this customer or machine"
        value={text} onChange={(e) => { setText(e.target.value); setMsg(""); }} />
      {msg && <div role="status" className="mt-2 text-[13px] text-muted">{msg}</div>}
      <GhostButton className="mt-3 w-full" disabled={!dirty || busy} onClick={save}>
        <Icon.check width={18} height={18} /> {busy ? "Saving…" : saved ? "Update remark" : "Save remark"}
      </GhostButton>
    </Card>
  );
}
