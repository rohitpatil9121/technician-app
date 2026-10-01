import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import AppHeader from "../components/AppHeader.jsx";
import { Icon, SkeletonJobCard, cx } from "../components/ui.jsx";
import { callPhone } from "../lib/contact.js";

/* Home: every open call in ONE list, every row the same size (owner's rule).

   Nothing sits above the list — no "Today's work" card, no enlarged first job.
   The only thing that sets a call apart is colour: a call that needs doing
   first is shaded red and carries a tag saying why —

     Revisit              the job came back (the request was reopened)
     More than 24 hours   he has had it for over a day

   Those rows lead the list; the rest follow in the order the server gave.
   Finished jobs are not listed here — they have their own tab, My Work. */

const CLOSED = (j) => j.status === "CLOSED";
const DAY_MS = 24 * 3600 * 1000;

const isRevisit = (j) => !!(j.revisit || j.work?.reopened_at);

/* Has he had this call for more than a day? `assignedAt` is when it became his.
   A backend that does not send it yet still files the call under "pending" when
   it was given on an earlier day, which is the nearest thing to the same fact. */
function isOverdue(j, now) {
  if (j.assignedAt) return now - new Date(j.assignedAt).getTime() > DAY_MS;
  return j.bucket === "pending";
}

/* Why a call is high priority, or null. Revisit wins when both are true. */
function priorityOf(j, now) {
  if (isRevisit(j)) return { rank: 0, label: "Revisit" };
  if (isOverdue(j, now)) return { rank: 1, label: "More than 24 hours" };
  return null;
}

/* One call. Same size for every job; red shade + tag when it is high priority. */
function JobRow({ job, priority, onOpen }) {
  const self = job.work?.added_by_tech;
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(job); }}
      className={cx(
        "m3r mt-2.5 flex cursor-pointer items-center gap-3 rounded-2xl border-l-4 py-3 pl-3 pr-3 shadow-card",
        priority ? "border-l-danger bg-danger-tint" : self ? "border-l-accent bg-surface" : "border-l-brand bg-surface"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[16.5px] font-bold tracking-tight text-strong">{job.name}</span>
          {priority && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-[11px] font-extrabold text-white">
              <Icon.alert width={11} height={11} /> {priority.label}
            </span>
          )}
          {self && !priority && (
            <span className="shrink-0 rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-extrabold text-accent">Added by you</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[13.5px] text-muted">
          <Icon.drop width={14} height={14} className="shrink-0" />
          <span className="truncate">{job.issue}</span>
          <span className="shrink-0 text-subtle">· {job.area}</span>
        </div>
      </div>
      <button type="button" aria-label={`Call ${job.name}`} disabled={!job.phone}
        onClick={(e) => { e.stopPropagation(); callPhone(job.phone); }}
        className={cx(
          "grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full disabled:opacity-40",
          priority ? "bg-surface text-danger" : "bg-brand-tint text-brand-dark"
        )}>
        <Icon.phone width={20} height={20} />
      </button>
    </div>
  );
}

export function HomeV2({ jobs = [], loading, error, staleWarning, onRetry, onOpen = () => {}, onNewCall = () => {} }) {
  // Re-read the clock every few minutes so a call crosses the 24-hour line
  // while the screen is simply left open.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    const open = jobs.filter((j) => !CLOSED(j)).map((job, i) => ({ job, i, priority: priorityOf(job, now) }));
    // High priority first (revisits, then overdue); otherwise the server's order.
    return open.sort((a, b) => (a.priority?.rank ?? 2) - (b.priority?.rank ?? 2) || a.i - b.i);
  }, [jobs, now]);

  if (error) {
    return (
      <div className="mt-8 rounded-2xl bg-surface px-4 py-8 text-center shadow-card">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-danger-tint text-danger">
          <Icon.alert width={22} height={22} />
        </span>
        <div className="mt-2.5 text-[15px] font-bold text-strong">Couldn't load your jobs</div>
        <div className="mt-1 text-sm text-muted">You may be offline. Your jobs are safe.</div>
        <button type="button" onClick={onRetry}
          className="mt-4 min-h-[44px] rounded-full bg-brand px-6 text-sm font-bold text-white">
          Try again
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <>
        <div className="mt-2"><SkeletonJobCard /></div>
        <div className="mt-3"><SkeletonJobCard /></div>
      </>
    );
  }

  return (
    <>
      {/* The list below is the last one we managed to fetch. Said plainly, above
          the jobs, so a technician working off a cached list knows it and can
          pull a fresh one — rather than trusting a screen that may have moved on. */}
      {staleWarning && (
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-warn-light px-3 py-2.5">
          <Icon.alert width={16} height={16} className="shrink-0 text-warn" />
          <span className="flex-1 text-[13px] text-strong">
            Showing your last saved jobs — couldn't reach the server.
          </span>
          <button type="button" onClick={onRetry}
            className="shrink-0 rounded-full bg-warn px-3 py-1 text-[12px] font-bold text-white">
            Retry
          </button>
        </div>
      )}

      {rows.length === 0 && (
        <div className="mt-2 rounded-2xl bg-surface px-4 py-8 text-center text-sm font-medium text-subtle shadow-card">
          No calls right now.
        </div>
      )}
      {rows.map(({ job, priority }) => (
        <JobRow key={job.id} job={job} priority={priority} onOpen={onOpen} />
      ))}

      <div className="h-24" />

      {/* Extended FAB (mockup .fab, M3 16px radius) */}
      <button type="button" onClick={onNewCall}
        className="fixed bottom-[86px] right-4 z-20 mx-auto flex items-center gap-2 rounded-2xl bg-brand py-4 pl-4 pr-5 text-[16px] font-semibold text-white shadow-[0_6px_16px_rgba(11,87,208,.36)] transition active:scale-[0.97]">
        <Icon.plus width={20} height={20} /> New Call
      </button>
    </>
  );
}

/* Route-level wrapper binding the store. */
export default function HomeScreen() {
  const { jobs, live, jobsLoading, jobsError, loadJobs } = useJobs();
  const nav = useNavigate();

  useEffect(() => {
    if (live) loadJobs({ background: true });
  }, [live, loadJobs]);

  return (
    <>
      <AppHeader />
      <HomeV2
        jobs={jobs}
        loading={jobsLoading && live && jobs.length === 0}
        // Only take over the whole screen when there is nothing to show. With
        // cached jobs on screen the technician can still work, so the failure
        // is reported as a banner above them instead.
        error={jobsError && jobs.length === 0 ? jobsError : null}
        staleWarning={jobsError && jobs.length > 0 ? jobsError : null}
        onRetry={() => loadJobs()}
        onOpen={(job) => nav(`/job/${job.id}`)}
        onNewCall={() => nav("/new-call")}
      />
    </>
  );
}
