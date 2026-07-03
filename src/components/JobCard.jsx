import { useNavigate } from "react-router-dom";
import { rupee } from "../lib/format.js";
import { callPhone, openMaps } from "../lib/contact.js";
import { Icon, Tag, StatusPill, GhostButton, PrimaryButton, cx } from "./ui.jsx";

export default function JobCard({ job }) {
  const nav = useNavigate();
  return (
    <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-slate-800">{job.name}</span>
            <StatusPill status={job.status} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Icon.pin width={13} height={13} /> {job.area}
            <span className="text-slate-300">•</span>
            <Icon.clock width={13} height={13} /> {job.when}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Visit</div>
          <div className={cx("text-sm font-bold", job.visitCharge === 0 ? "text-ok" : "text-slate-700")}>
            {rupee(job.visitCharge)}
          </div>
        </div>
      </div>

      <div className="mt-2 text-[15px] text-slate-800">{job.issue}</div>
      <div className="text-sm text-slate-400">{job.model}</div>

      {job.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {job.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_1fr_1.1fr] gap-2">
        <GhostButton onClick={() => callPhone(job.phone)} disabled={!job.phone}><Icon.phone width={16} height={16} /> Call</GhostButton>
        <GhostButton className="!border-ok/30 !text-ok" onClick={() => openMaps(job.address)} disabled={!job.address}><Icon.map width={16} height={16} /> Maps</GhostButton>
        <PrimaryButton className="!py-3 !text-sm" onClick={() => nav(`/job/${job.id}`)}>
          Open <Icon.chevron width={16} height={16} />
        </PrimaryButton>
      </div>
    </div>
  );
}
