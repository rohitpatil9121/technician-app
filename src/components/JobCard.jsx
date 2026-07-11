import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { rupee } from "../lib/format.js";
import { callPhone, openMaps, openWhatsApp } from "../lib/contact.js";
import { STATUS_STRIPE } from "../lib/workflow.js";
import { Icon, Tag, StatusPill, GhostButton, PrimaryButton, cx } from "./ui.jsx";

const Stars = ({ n }) => (
  <span className="inline-flex text-amber-400">
    {Array.from({ length: 5 }).map((_, i) => (
      <Icon.star key={i} width={12} height={12} className={i < n ? "" : "text-slate-200"} />
    ))}
  </span>
);

function JobCard({ job }) {
  const nav = useNavigate();
  const stripe = STATUS_STRIPE[job.status] || "border-l-slate-200";
  const closed = job.status === "CLOSED";

  return (
    <div className={cx(
      "mb-3 overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-card",
      stripe
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold text-slate-800">{job.name}</span>
              <StatusPill status={job.status} />
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-slate-400">{job.code || job.id}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <Icon.pin width={13} height={13} className="shrink-0" /> {job.area}
              <span className="text-slate-300">•</span>
              <Icon.clock width={13} height={13} className="shrink-0" /> {job.when}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Visit</div>
            <div className={cx("text-sm font-bold", job.visitCharge === 0 ? "text-ok" : "text-slate-700")}>
              {rupee(job.visitCharge)}
            </div>
          </div>
        </div>

        <div className="mt-2 line-clamp-2 text-[15px] text-slate-800">{job.issue}</div>
        <div className="text-sm text-slate-400">{job.model}</div>

        {job.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
        )}

        {closed && job.rating != null && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 w-fit">
            <Stars n={job.rating} />
            <span className="text-xs font-medium text-amber-700">Customer rated</span>
          </div>
        )}

        {!closed && job.status === "ESTIMATE_SENT" && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-warn-light px-2.5 py-1.5 text-xs font-medium text-warn">
            <Icon.clock width={13} height={13} /> Waiting for customer approval
          </div>
        )}

        <div className="mt-3 grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-1.5">
          <GhostButton className="!gap-1 !px-2" onClick={() => callPhone(job.phone)} disabled={!job.phone}>
            <Icon.phone width={16} height={16} /> Call
          </GhostButton>
          <GhostButton className="!gap-1 !px-2 !border-[#25D366]/40 !text-[#1DA851]" onClick={() => openWhatsApp(job.phone)} disabled={!job.phone}>
            <Icon.whatsapp width={16} height={16} /> WA
          </GhostButton>
          <GhostButton className="!gap-1 !px-2 !border-ok/30 !text-ok" onClick={() => openMaps(job.address)} disabled={!job.address}>
            <Icon.map width={16} height={16} /> Maps
          </GhostButton>
          <PrimaryButton className="!gap-1 !px-2 !py-3 !text-sm" onClick={() => nav(`/job/${job.id}`)}>
            Open <Icon.chevron width={16} height={16} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

export default memo(JobCard);
