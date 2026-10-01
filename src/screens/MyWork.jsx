import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader.jsx";
import { useJobs } from "../store/JobsContext.jsx";
import { api } from "../lib/api.js";
import { Icon, Card, cx } from "../components/ui.jsx";
import { rupeeAmt } from "../lib/format.js";

/* My Work — what the technician has done and what it pays, a week at a time.

   Incentive is a fixed amount per closed call, chosen by the customer's rating,
   and it is paid weekly. So the screen answers exactly that: how many calls this
   week, how much for them, and the sum worked out line by line so he can check
   it himself. Under each date sits every call of that day with its rating and
   what it paid — this replaces the "Done" list Home used to have.

   A week is Monday to Sunday, in IST. */

const DAY = 86400000;
const CACHE_KEY = "og-earnings-v1";

// IST calendar dates as "YYYY-MM-DD" strings; arithmetic is done on UTC
// midnights built from those strings, so the phone's own timezone never leaks in.
const istDate = (d = new Date()) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const toUTC = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => new Date(toUTC(s).getTime() + n * DAY).toISOString().slice(0, 10);
const weekStart = (s) => addDays(s, -((toUTC(s).getUTCDay() + 6) % 7)); // back to Monday
const fmt = (s, opts) => toUTC(s).toLocaleDateString("en-IN", { timeZone: "UTC", ...opts });
const shortDay = (s) => fmt(s, { day: "numeric", month: "short" });

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };
const writeCache = (v) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* storage full — skip */ } };

// The three lines of the sum. A call with no rating yet is paid as Average.
const BUCKETS = [
  { key: "very_good", label: "Very Good", tone: "text-ok-fg" },
  { key: "average", label: "Average / no feedback", tone: "text-strong" },
  { key: "bad", label: "Bad", tone: "text-danger" },
];
const bucketOf = (job) => (job.feedback === "pending" ? "average" : job.feedback);

/* Roll a set of days up into calls + incentive, split by rating. */
function summarise(days) {
  const by = { very_good: { calls: 0, amount: 0 }, average: { calls: 0, amount: 0 }, bad: { calls: 0, amount: 0 } };
  let calls = 0, amount = 0, waiting = 0;
  for (const d of days) {
    for (const j of d.jobs || []) {
      const b = by[bucketOf(j)] || by.average;
      b.calls += 1; b.amount += Number(j.payout || 0);
      calls += 1; amount += Number(j.payout || 0);
      if (j.pending) waiting += 1;
    }
  }
  return { by, calls, amount, waiting };
}

const SecH = ({ children }) => (
  <div className="mx-1 mb-2 mt-5 text-[12.5px] font-semibold uppercase tracking-wide text-muted">{children}</div>
);

// How a call's rating reads on its row.
const RATING = {
  very_good: { label: "Very Good", cls: "bg-ok-tint text-ok-fg" },
  average: { label: "Average", cls: "bg-tonal text-muted" },
  bad: { label: "Bad", cls: "bg-danger-tint text-danger" },
  pending: { label: "No rating yet", cls: "bg-warn-tint text-warn-fg" },
};

/* One call under its date: who, the rating, what it pays. Opens the job when
   the app still has it; otherwise it is just a line. */
function CallRow({ call, job, onOpen }) {
  const r = RATING[call.feedback] || RATING.average;
  const name = call.customer_name || job?.name;
  const Tag = job ? "button" : "div";
  return (
    <Tag type={job ? "button" : undefined} onClick={job ? () => onOpen(job) : undefined}
      className="flex w-full items-center gap-2.5 border-t border-hair py-2.5 text-left">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold text-strong">{name || call.ticket_number || "Call"}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-subtle">
          <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-bold", r.cls)}>{r.label}</span>
          {name && call.ticket_number && <span className="truncate">{call.ticket_number}</span>}
        </div>
      </div>
      <span className="tnum shrink-0 text-[15px] font-bold text-strong">{rupeeAmt(call.payout)}</span>
    </Tag>
  );
}

export default function MyWork() {
  const { jobs, live } = useJobs();
  const nav = useNavigate();
  const today = istDate();
  const thisWeek = weekStart(today);
  const monthStart = today.slice(0, 8) + "01";
  // Far enough back to cover this month and the few weeks before it.
  const rangeFrom = weekStart(addDays(monthStart, -28));

  const [week, setWeek] = useState(thisWeek);
  const [data, setData] = useState(readCache);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await api.earnings(rangeFrom, today);
      setData(next); writeCache(next); setErr("");
    } catch (e) { setErr(e.message || "Couldn't load"); }
  }, [rangeFrom, today]);

  useEffect(() => { if (live) load(); }, [live, load]);

  const days = data?.days || [];
  const rates = data?.rates || null;
  const weekEnd = addDays(week, 6);

  const { wk, month, perDay } = useMemo(() => {
    const inWeek = days.filter((d) => d.date >= week && d.date <= weekEnd);
    const byDate = new Map(inWeek.map((d) => [d.date, d]));
    return {
      wk: summarise(inWeek),
      month: summarise(days.filter((d) => d.date >= monthStart)),
      perDay: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(week, i);
        const d = byDate.get(date);
        return { date, jobs: d?.jobs || [], calls: d?.jobs?.length || 0, amount: Number(d?.payout || 0) };
      }),
    };
  }, [days, week, weekEnd, monthStart]);

  // The app's own copy of each job, to put a customer name on a call and open it.
  const jobById = useMemo(() => {
    const m = new Map();
    for (const j of jobs) { m.set(String(j.id), j); if (j.code) m.set(j.code, j); }
    return m;
  }, [jobs]);
  const jobFor = (call) => jobById.get(String(call.ticket_id)) || jobById.get(call.ticket_number) || null;

  const isThisWeek = week === thisWeek;
  const canPrev = addDays(week, -7) >= rangeFrom;
  const weekLabel = isThisWeek ? "This week" : week === addDays(thisWeek, -7) ? "Last week" : `${shortDay(week)} – ${shortDay(weekEnd)}`;
  // Rate per call for a rating: what the office set, else worked back from the calls.
  const rateOf = (key) => {
    if (rates && rates[key] != null) return Number(rates[key]);
    const b = wk.by[key];
    return b.calls ? b.amount / b.calls : null;
  };

  return (
    <>
      <AppHeader />
      <div className="mb-2.5 mt-1 text-[30px] font-extrabold tracking-tight text-strong">My Work</div>

      {err && !data && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-warn-light px-3 py-2.5">
          <Icon.alert width={16} height={16} className="shrink-0 text-warn" />
          <span className="flex-1 text-[13px] text-strong">Couldn't load your work — you may be offline.</span>
          <button type="button" onClick={load} className="shrink-0 rounded-full bg-warn px-3 py-1 text-[12px] font-bold text-white">Retry</button>
        </div>
      )}

      {/* Week switcher */}
      <div className="flex items-center justify-between rounded-full border border-hair px-1.5 py-1">
        <button type="button" aria-label="Previous week" disabled={!canPrev} onClick={() => setWeek(addDays(week, -7))}
          className="grid h-10 w-10 place-items-center rounded-full text-brand disabled:opacity-30">
          <Icon.chevron width={20} height={20} className="rotate-180" />
        </button>
        <div className="text-center">
          <div className="text-[15px] font-bold text-strong">{weekLabel}</div>
          <div className="text-[12px] text-muted">{shortDay(week)} – {shortDay(weekEnd)}</div>
        </div>
        <button type="button" aria-label="Next week" disabled={isThisWeek} onClick={() => setWeek(addDays(week, 7))}
          className="grid h-10 w-10 place-items-center rounded-full text-brand disabled:opacity-30">
          <Icon.chevron width={20} height={20} />
        </button>
      </div>

      {/* The two numbers that matter */}
      <Card className="mt-3 !rounded-[20px] !p-[18px]">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-muted">Calls done</div>
            <div className="tnum mt-0.5 text-[44px] font-extrabold leading-none tracking-tight text-strong">{wk.calls}</div>
          </div>
          <div className="flex-1 border-l border-hair pl-3">
            <div className="text-sm font-medium text-muted">Your incentive</div>
            <div className="tnum mt-0.5 text-[44px] font-extrabold leading-none tracking-tight text-ok-fg">{rupeeAmt(wk.amount)}</div>
          </div>
        </div>

        {/* The sum, line by line */}
        <div className="mt-4 border-t border-hair pt-3">
          {BUCKETS.map(({ key, label, tone }) => {
            const b = wk.by[key];
            const rate = rateOf(key);
            return (
              <div key={key} className="flex items-baseline justify-between py-1.5 text-[15px]">
                <span className={cx("font-semibold", tone)}>{label}</span>
                <span className="tnum text-muted">
                  {b.calls} × {rate != null ? rupeeAmt(rate) : "—"} = <b className="font-bold text-strong">{rupeeAmt(b.amount)}</b>
                </span>
              </div>
            );
          })}
          <div className="mt-1 flex items-baseline justify-between border-t border-hair pt-2 text-[16px] font-extrabold text-strong">
            <span>Total</span>
            <span className="tnum">{wk.calls} calls = {rupeeAmt(wk.amount)}</span>
          </div>
        </div>

        {wk.waiting > 0 && (
          <div className="mt-3 rounded-xl bg-tonal px-3 py-2 text-[12.5px] text-muted">
            {wk.waiting} call{wk.waiting === 1 ? " is" : "s are"} waiting for the customer's rating. Counted as Average for now — it changes if they rate Very Good or Bad.
          </div>
        )}
      </Card>

      {/* Day by day, every call under its date */}
      <SecH>Day by day</SecH>
      {perDay.map((d) => (
        <Card key={d.date} className={cx("mt-2.5 !py-2", d.date > today && "opacity-40")}>
          <div className="flex items-center justify-between py-1.5 text-[15px]">
            <span className={cx("font-bold", d.date === today ? "text-brand" : "text-strong")}>
              {fmt(d.date, { weekday: "short" })}, {shortDay(d.date)}{d.date === today ? " · Today" : ""}
            </span>
            <span className="tnum text-muted">
              {d.calls} call{d.calls === 1 ? "" : "s"} · <b className="font-bold text-strong">{rupeeAmt(d.amount)}</b>
            </span>
          </div>
          {d.jobs.map((c) => (
            <CallRow key={c.ticket_id || c.ticket_number} call={c} job={jobFor(c)} onOpen={(job) => nav(`/job/${job.id}`)} />
          ))}
        </Card>
      ))}

      {/* Whole month */}
      <SecH>{fmt(monthStart, { month: "long" })} so far</SecH>
      <Card>
        <div className="flex gap-2">
          {[[month.calls, "Calls"], [rupeeAmt(month.amount), "Incentive"]].map(([v, l]) => (
            <div key={l} className="flex-1 rounded-xl bg-tonal px-2 py-2.5 text-center">
              <div className="tnum text-[22px] font-extrabold text-strong">{v}</div>
              <div className="mt-0.5 text-[11.5px] font-medium text-muted">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="h-6" />
    </>
  );
}
