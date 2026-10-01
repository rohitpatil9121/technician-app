import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import AppHeader from "../components/AppHeader.jsx";
import { Icon, IconChip, SkeletonJobCard, cx } from "../components/ui.jsx";
import { callPhone, openMaps, openWhatsApp } from "../lib/contact.js";

/* Home, Material 3 redesign (client mockup): a progress ring for today, a
   "Do first" amber hero, then plain job rows. The FAB adds a walk-in call.
   Finished jobs are not listed here — they have their own tab, My Work. */

const CLOSED = (j) => j.status === "CLOSED";

/* Which IST day a job was finished on, from the closing stamp the backend keeps
   in tech_work. Jobs closed before that stamp existed return null.

   This matters because "Today's work" was counting every job the technician had
   ever closed: Chhagan Bhamre's phone read "166 done, 4 to go" with the ring
   almost full, as though he had done 166 jobs since breakfast. It can only ever
   climb, so the one number meant to show today's progress showed nothing at all. */
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const closedIST = (j) => {
  const at = j.work?.closed_at;
  return at ? new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : null;
};
/* SVG progress ring (mockup ringSVG). */
function Ring({ done, total, size = 52, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = total > 0 ? c * (1 - done / total) : c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${done} of ${total} jobs done`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAEAEF" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#146C2E" strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
        className="fill-strong" fontSize={size * 0.28} fontWeight="800">{done}/{total}</text>
    </svg>
  );
}

/* Section heading with a coloured dot (mockup .hsech). */
const SecHead = ({ tone, label, count }) => (
  <div className="mx-1 mb-2 mt-4 flex items-center gap-2">
    <span className={cx("h-[9px] w-[9px] rounded-full", tone === "amber" ? "bg-warn" : "bg-brand")} aria-hidden="true" />
    <span className={cx("text-[13px] font-extrabold uppercase tracking-wide", tone === "amber" ? "text-warn-fg" : "text-brand")}>{label}</span>
    <span className="text-[12.5px] font-bold text-subtle">{count}</span>
  </div>
);

/* Compact job row (mockup .jcard2) — left accent by bucket, call circle right. */
function JobRow({ job, accent, self, onOpen }) {
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(job); }}
      className={cx(
        "m3r mt-2.5 flex cursor-pointer items-center gap-3 rounded-2xl border-l-4 bg-surface py-3 pl-3 pr-3 shadow-card",
        accent === "amber" ? "border-l-warn" : accent === "purple" ? "border-l-accent" : "border-l-brand"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[16.5px] font-bold tracking-tight text-strong">
          <span className="truncate">{job.name}</span>
          {accent === "amber" && (
            <span className="shrink-0 rounded-full bg-warn-tint px-2 py-0.5 text-[11px] font-extrabold text-warn-fg">Pending</span>
          )}
          {self && (
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
        className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-brand-tint text-brand-dark disabled:opacity-40">
        <Icon.phone width={20} height={20} />
      </button>
    </div>
  );
}

/* The "Do first" hero (mockup .hero.pending). */
function PendingHero({ job, onOpen }) {
  return (
    <div className="overflow-hidden rounded-[20px] border-[1.5px] border-warn-tint bg-surface shadow-[0_8px_22px_rgba(232,113,10,.16)]">
      <div className="p-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-tint px-2.5 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-warn-fg">
          <Icon.alert width={13} height={13} /> Pending
        </span>
        <div className="mt-1.5 text-[23px] font-extrabold tracking-tight text-strong">{job.name}</div>
        <div className="mt-1.5 flex gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Icon.pin width={15} height={15} /> {job.area}</span>
          <span className="inline-flex min-w-0 items-center gap-1.5"><Icon.drop width={15} height={15} /> <span className="truncate">{job.issue}</span></span>
        </div>
        <div className="mt-3.5 flex gap-2">
          <HeroAct label={`Call ${job.name}`} disabled={!job.phone} onClick={() => callPhone(job.phone)}>
            <Icon.phone width={19} height={19} /><span>Call</span>
          </HeroAct>
          <HeroAct label={`WhatsApp ${job.name}`} disabled={!job.phone} green onClick={() => openWhatsApp(job.phone)}>
            <Icon.whatsapp width={19} height={19} /><span>WhatsApp</span>
          </HeroAct>
          <HeroAct label={`Map to ${job.area}`} disabled={!job.address} onClick={() => openMaps(job.address)}>
            <Icon.pin width={19} height={19} /><span>Map</span>
          </HeroAct>
        </div>
      </div>
      <button type="button" onClick={() => onOpen(job)}
        className="flex w-full items-center justify-center gap-2 bg-warn py-[17px] text-[18px] font-semibold text-white">
        Start This Job <Icon.chevron width={18} height={18} />
      </button>
    </div>
  );
}

const HeroAct = ({ label, disabled, green, onClick, children }) => (
  <button type="button" aria-label={label} disabled={disabled}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={cx(
      "flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[13px] font-semibold disabled:opacity-40",
      green ? "bg-ok-tint text-wa-dark" : "bg-tonal text-brand"
    )}>
    {children}
  </button>
);

export function HomeV2({ jobs = [], loading, error, staleWarning, onRetry, onOpen = () => {}, onNewCall = () => {} }) {
  const { pendingJobs, todayJobs, doneToday, activeCount } = useMemo(() => {
    const done = jobs.filter(CLOSED);
    const pending = jobs.filter((j) => !CLOSED(j) && j.bucket === "pending");
    const today = jobs.filter((j) => !CLOSED(j) && j.bucket !== "pending");
    return {
      pendingJobs: pending,
      todayJobs: today,
      doneToday: done.filter((j) => closedIST(j) === istToday()).length,
      activeCount: pending.length + today.length,
    };
  }, [jobs]);

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
        <div className="skeleton mt-2 h-24 w-full rounded-2xl" />
        <div className="mt-3"><SkeletonJobCard /></div>
      </>
    );
  }

  const hero = pendingJobs[0];
  const restPending = pendingJobs.slice(1);

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

      <>
          {/* Today's progress (mockup .hprog) */}
          <div className="mt-3 flex items-center gap-3.5 rounded-2xl bg-surface px-4 py-3 shadow-card">
            <Ring done={doneToday} total={doneToday + activeCount} />
            <div className="flex-1">
              <div className="text-[15px] font-bold text-strong">Today's work</div>
              <div className="mt-0.5 text-[12.5px] text-muted">{doneToday} done · {activeCount} to go</div>
              <div className="mt-2 h-[9px] overflow-hidden rounded-full bg-tonal">
                {/* Same figures as the ring beside it. The bar was still on the
                    all-time count, so it sat pinned near full while the ring
                    showed the real day — two numbers for one thing, disagreeing. */}
                <i className="block h-full rounded-full bg-ok"
                  style={{ width: `${doneToday + activeCount ? (doneToday / (doneToday + activeCount)) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {pendingJobs.length > 0 && (
            <>
              <SecHead tone="amber" label="Do first — Pending" count={pendingJobs.length} />
              <PendingHero job={hero} onOpen={onOpen} />
              {restPending.map((j) => <JobRow key={j.id} job={j} accent="amber" onOpen={onOpen} />)}
            </>
          )}

          <SecHead tone="blue" label="Today" count={todayJobs.length} />
          {todayJobs.length === 0 && (
            <div className="mt-2 rounded-2xl bg-surface px-4 py-6 text-center text-sm font-medium text-subtle shadow-card">
              Nothing else scheduled for today.
            </div>
          )}
          {todayJobs.map((j) => (
            <JobRow key={j.id} job={j} accent={j.work?.added_by_tech ? "purple" : "blue"} self={j.work?.added_by_tech} onOpen={onOpen} />
          ))}
      </>

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
