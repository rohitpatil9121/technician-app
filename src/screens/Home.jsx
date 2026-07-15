import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { technician, repeatCalls, escalations } from "../data/mock.js";
import AppHeader from "../components/AppHeader.jsx";
import JobCard from "../components/JobCard.jsx";
import { Icon, SectionLabel, SkeletonJobCard, EmptyState } from "../components/ui.jsx";

function Stat({ icon, label, value }) {
  return (
    <div className="flex-1 rounded-xl bg-white/15 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-white/80">{icon} {label}</div>
      <div className="text-2xl font-extrabold leading-tight">{value}</div>
    </div>
  );
}

export default function Home() {
  const { jobs, user, reviews, live, jobsLoading, loadJobs } = useJobs();
  const nav = useNavigate();

  // Customer ratings land AFTER a job closes (customer rates later), so the job
  // list loaded earlier still has rating=null. Refresh in the background each time
  // Home opens — otherwise a freshly-rated closed job shows no stars here even
  // though the Reviews tab already has it.
  useEffect(() => {
    if (live) loadJobs({ background: true });
  }, [live, loadJobs]);
  const firstName = (user?.full_name || technician.name).split(" ")[0];
  const rating = live ? reviews?.average ?? "—" : technician.rating;

  const { closed, pending, today, needsAction } = useMemo(() => ({
    closed: jobs.filter((j) => j.status === "CLOSED"),
    pending: jobs.filter((j) => j.bucket === "pending" && j.status !== "CLOSED"),
    today: jobs.filter((j) => j.bucket === "today" && j.status !== "CLOSED"),
    needsAction: jobs.filter((j) => j.status === "NEW" || j.status === "ESTIMATE_SENT"),
  }), [jobs]);

  return (
    <>
      <AppHeader />

      <div className="mt-1 rounded-2xl bg-gradient-to-br from-brand-light to-brand-dark p-4 text-white shadow-pop">
        <div className="text-sm text-white/85">Namaste 🙏</div>
        <div className="flex items-center gap-2 text-xl font-extrabold">
          {firstName}, ready for today?
          <span className="flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5 text-sm">
            <Icon.star width={14} height={14} /> {rating}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Stat icon={<Icon.clock width={13} height={13} />} label="Pending" value={pending.length} />
          <Stat icon={<Icon.truck width={13} height={13} />} label="Today" value={today.length} />
          <Stat icon={<Icon.checkCircle width={13} height={13} />} label="Done today" value={closed.length} />
        </div>
      </div>

      {needsAction.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-light px-3 py-2.5">
          <Icon.alert width={16} height={16} className="shrink-0 text-warn" />
          <span className="text-sm text-slate-700">
            <b>{needsAction.length}</b> job{needsAction.length === 1 ? "" : "s"} need{needsAction.length === 1 ? "s" : ""} your action
          </span>
        </div>
      )}

      {jobsLoading && live && jobs.length === 0 ? (
        <>
          <SectionLabel>Loading jobs…</SectionLabel>
          <SkeletonJobCard />
          <SkeletonJobCard />
        </>
      ) : (
        <>
          {pending.length > 0 && (
            <>
              <SectionLabel>Pending from previous days</SectionLabel>
              {pending.map((j) => <JobCard key={j.id} job={j} />)}
            </>
          )}

          <SectionLabel>Today's jobs</SectionLabel>
          {today.length > 0 ? (
            today.map((j) => <JobCard key={j.id} job={j} />)
          ) : (
            <EmptyState icon={Icon.truck} title="No open jobs for today" sub="Pull down to refresh when new jobs are assigned" />
          )}

          <SectionLabel>Completed today</SectionLabel>
          {closed.length > 0 ? (
            closed.map((j) => <JobCard key={j.id} job={j} />)
          ) : (
            <EmptyState icon={Icon.checkCircle} title="None closed yet today" />
          )}
        </>
      )}

      {!live && <>
      <SectionLabel>Repeat calls (within 7 days)</SectionLabel>
      {repeatCalls.map((r) => (
        <button
          key={r.id + r.days}
          onClick={() => nav(`/job/${r.id}`)}
          className="mb-2 w-full rounded-2xl border border-danger/20 bg-danger-light/40 p-3 text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Icon.spark width={15} height={15} className="text-danger" /> {r.name}
            </div>
            <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
              REPEAT • {r.days}D
            </span>
          </div>
          <div className="text-xs text-slate-500">{r.area} • {r.model}</div>
          <div className="mt-0.5 text-sm text-slate-700">{r.issue}</div>
          <div className="mt-1 text-xs text-slate-400">
            No charge: customer not billed again within 7-day window.
          </div>
        </button>
      ))}

      <SectionLabel>Escalations</SectionLabel>
      {escalations.map((e) => (
        <div key={e.id} className="mb-2 rounded-2xl border border-danger/20 bg-danger-light/40 p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-800">{e.name}</div>
            <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">URGENT</span>
          </div>
          <div className="text-xs text-slate-500">{e.area}</div>
          <div className="mt-0.5 text-sm text-slate-700">{e.note}</div>
        </div>
      ))}
      </>}
      <div className="h-2" />
    </>
  );
}
