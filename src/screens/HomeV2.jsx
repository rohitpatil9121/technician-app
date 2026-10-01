import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import AppHeader from "../components/AppHeader.jsx";
import { Icon, SkeletonJobCard, MDialog, MDialogBtn, cx } from "../components/ui.jsx";
import { callPhone } from "../lib/contact.js";
import { rupeeAmt } from "../lib/format.js";
import { api } from "../lib/api.js";

/* Home: a Pending / Completed switch under the technician's name, then the list.

   Pending is every open call in ONE list, every row the same size (owner's
   rule) — no "Today's work" card, no enlarged first job. Completed is the jobs
   he has finished, newest day first.

   On Pending the only thing that sets a call apart is colour: a call that needs doing
   first is shaded red and carries a tag saying why —

     Revisit              the job came back (the request was reopened)
     More than 24 hours   he has had it for over a day

   Those rows lead the list; the rest follow in the order the server gave. */

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

/* Which IST day a job was finished on, and how that day reads as a heading. */
const istDay = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const closedDayLabel = (j) => {
  const at = j.work?.closed_at;
  if (!at) return String(j.when || "Earlier").split(",")[0]; // closed before the stamp existed
  const d = istDay(at);
  if (d === istDay(Date.now())) return "Today";
  if (d === istDay(Date.now() - DAY_MS)) return "Yesterday";
  return new Date(at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
};

/* A finished job: who, where, what was billed — and a Revisit button for when
   that customer asks him to come back. */
function DoneRow({ job, onOpen, onRevisit }) {
  const total = Number(job.work?.total ?? 0);
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(job)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(job); }}
      className="m3r mt-2.5 cursor-pointer rounded-2xl bg-surface px-3.5 py-3 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-ok-tint text-ok-fg">
          <Icon.check width={17} height={17} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15.5px] font-bold text-strong">{job.name}</div>
          <div className="text-[13px] text-subtle">{job.area}</div>
        </div>
        <span className={cx("tnum shrink-0 text-sm font-bold", total === 0 ? "text-muted" : "text-ok-fg")}>
          {total === 0 ? "Free" : rupeeAmt(total)}
        </span>
      </div>
      {onRevisit && (
        <button type="button" aria-label={`Revisit ${job.name}`}
          onClick={(e) => { e.stopPropagation(); onRevisit(job); }}
          className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-danger/40 bg-surface text-[14.5px] font-bold text-danger transition active:scale-[0.985]">
          <Icon.repeat width={16} height={16} /> Revisit
        </button>
      )}
    </div>
  );
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

export function HomeV2({ jobs = [], loading, error, staleWarning, onRetry, onOpen = () => {}, onNewCall = () => {}, onRevisit }) {
  /* Revisit is confirmed before anything is sent: it opens a new call and the
     customer gets a WhatsApp, so a stray tap must not do it. */
  const [revisitJob, setRevisitJob] = useState(null);
  const [revisitBusy, setRevisitBusy] = useState(false);
  const [revisitErr, setRevisitErr] = useState("");
  const confirmRevisit = async () => {
    if (revisitBusy) return;
    setRevisitBusy(true); setRevisitErr("");
    try {
      await onRevisit(revisitJob);
      setRevisitJob(null);
      setTab("pending"); // the new call is at the top of Pending, tagged Revisit
    } catch (e) {
      setRevisitErr(e.message || "Could not open the revisit. Check your connection and try again.");
    } finally { setRevisitBusy(false); }
  };

  // Re-read the clock every few minutes so a call crosses the 24-hour line
  // while the screen is simply left open.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const [tab, setTab] = useState("pending");

  // Finished jobs grouped by the day they were closed, in the server's order
  // (newest first).
  const doneGroups = useMemo(() => {
    const groups = [];
    for (const j of jobs.filter(CLOSED)) {
      const day = closedDayLabel(j);
      const g = groups.find((x) => x.day === day);
      if (g) g.items.push(j); else groups.push({ day, items: [j] });
    }
    return groups;
  }, [jobs]);
  const doneCount = doneGroups.reduce((s, g) => s + g.items.length, 0);

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

      {/* Pending / Completed switch, right under the name. */}
      <div className="mt-1 flex overflow-hidden rounded-full border border-hair">
        {[["pending", "Pending", rows.length, Icon.alert], ["completed", "Completed", doneCount, Icon.check]].map(([key, label, count, Ic], i) => (
          <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key}
            className={cx(
              "flex min-h-[46px] flex-1 items-center justify-center gap-2 text-[15px] font-semibold",
              i === 0 && "border-r border-hair",
              tab === key ? "bg-brand-tint font-bold text-brand-dark" : "text-muted"
            )}>
            <Ic width={16} height={16} /> {label}
            <span className={cx("rounded-full px-2 py-0.5 text-xs font-extrabold", tab === key ? "bg-brand-dark text-white" : "bg-tonal text-muted")}>{count}</span>
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <>
          {rows.length === 0 && (
            <div className="mt-2.5 rounded-2xl bg-surface px-4 py-8 text-center text-sm font-medium text-subtle shadow-card">
              No pending calls right now.
            </div>
          )}
          {rows.map(({ job, priority }) => (
            <JobRow key={job.id} job={job} priority={priority} onOpen={onOpen} />
          ))}
        </>
      ) : (
        <>
          {doneGroups.length === 0 && (
            <div className="mt-2.5 rounded-2xl bg-surface px-4 py-8 text-center text-sm font-medium text-subtle shadow-card">
              No completed jobs yet.
            </div>
          )}
          {doneGroups.map((g) => (
            <div key={g.day}>
              <div className="mx-1 mb-1 mt-4 text-[13px] font-extrabold text-muted">{g.day}</div>
              {g.items.map((j) => (
                <DoneRow key={j.id} job={j} onOpen={onOpen}
                  onRevisit={onRevisit ? (job) => { setRevisitErr(""); setRevisitJob(job); } : undefined} />
              ))}
            </div>
          ))}
        </>
      )}

      <div className="h-24" />

      {revisitJob && (
        <MDialog title={`Revisit ${revisitJob.name}?`} onClose={() => !revisitBusy && setRevisitJob(null)}
          icon={<Icon.repeat width={22} height={22} className="text-danger" />} iconClass="bg-danger-tint"
          actions={
            <>
              <MDialogBtn disabled={revisitBusy} onClick={() => setRevisitJob(null)}>Cancel</MDialogBtn>
              <MDialogBtn danger bold disabled={revisitBusy} onClick={confirmRevisit}>
                {revisitBusy ? "Opening…" : "Yes, Revisit"}
              </MDialogBtn>
            </>
          }>
          This opens a new call for this customer in Pending, marked Revisit. The customer gets a WhatsApp message.
          {revisitErr && <span className="mt-2 block font-semibold text-danger">{revisitErr}</span>}
        </MDialog>
      )}

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
  const { jobs, live, jobsLoading, jobsError, loadJobs, addJob } = useJobs();
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
        onRevisit={async (job) => {
          const { job: created } = await api.revisit(job.id);
          if (!created) throw new Error("Could not open the revisit");
          addJob(created);
        }}
      />
    </>
  );
}
