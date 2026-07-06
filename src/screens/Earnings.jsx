import { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader.jsx";
import { useJobs } from "../store/JobsContext.jsx";
import { Icon, Card, cx } from "../components/ui.jsx";
import { rupeeAmt } from "../lib/format.js";
import { api } from "../lib/api.js";

const TARGET = 10000;
const BRAND_LABEL = { kent: "Kent", aquaguard: "Aquaguard", oasis: "Oasis", other: "Other" };
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n) => String(n).padStart(2, "0");
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
// Compact rupees for a tiny calendar cell: ₹650, ₹1.2k.
const compact = (n) => (n >= 1000 ? "₹" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : "₹" + n);
const prettyDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// Today's progress is the most recent day in the report (backend returns today first).
function todayOf(data) {
  const d = data?.days?.find((x) => x.date === istToday());
  return { billing: d?.billing || 0, payout: d?.payout || 0, target_hit: d?.target_hit || false, rate: d?.brand_rate || 0.06 };
}

export default function Earnings() {
  const { live } = useJobs();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!live) return;
    api.earnings().then(setData).catch((e) => console.error("earnings:", e.message));
  }, [live]);

  // date string → day summary
  const byDate = useMemo(() => {
    const m = new Map();
    (data?.days || []).forEach((d) => m.set(d.date, d));
    return m;
  }, [data]);

  // Calendar starts on the month of the latest earning (or this month).
  const latest = data?.days?.[0]?.date || istToday();
  const [view, setView] = useState(() => ({ y: +latest.slice(0, 4), m: +latest.slice(5, 7) - 1 }));
  const [selected, setSelected] = useState(latest);

  if (!data) {
    return (
      <>
        <AppHeader title="My Earnings" />
        <Card className="mt-2 !py-6 text-center text-sm text-slate-400">Loading…</Card>
      </>
    );
  }

  const today = todayOf(data);
  const pct = Math.min(100, Math.round((today.billing / TARGET) * 100));
  const remaining = Math.max(0, TARGET - today.billing);

  // Build the month grid (leading blanks + day numbers).
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthTitle = new Date(view.y, view.m, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const monthPayout = (data.days || [])
    .filter((d) => d.date.startsWith(`${view.y}-${pad(view.m + 1)}`))
    .reduce((s, d) => s + d.payout, 0);
  const shift = (delta) => {
    const dt = new Date(view.y, view.m + delta, 1);
    setView({ y: dt.getFullYear(), m: dt.getMonth() });
  };

  const sel = byDate.get(selected);
  const todayKey = istToday();

  return (
    <>
      <AppHeader title="My Earnings" />

      {/* Today's 10k progress + bonus rate (compact) */}
      <div className="mt-1 rounded-2xl bg-gradient-to-br from-brand-light to-brand-dark p-3 text-white shadow-pop">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-white/85">Today's billing</div>
            <div className="text-2xl font-extrabold leading-tight">{rupeeAmt(today.billing)}</div>
          </div>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
            {Math.round(today.rate * 100)}% Kent/Aqua
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-all" style={{ width: pct + "%" }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-white/85">
            {today.target_hit ? "🎉 10% unlocked all day" : `₹${remaining.toLocaleString("en-IN")} more for 10%`}
          </span>
          <span className="text-white/80">Earned <b className="text-white">{rupeeAmt(today.payout)}</b></span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="flex items-center justify-between rounded-xl border border-ok/20 bg-ok-light px-3 py-1.5">
          <span className="text-xs text-slate-500">Total earned</span>
          <span className="text-base font-extrabold text-ok">{rupeeAmt(data.total_payout)}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-brand/20 bg-brand-50 px-3 py-1.5">
          <span className="text-xs text-slate-500">Billed</span>
          <span className="text-base font-extrabold text-brand-dark">{rupeeAmt(data.total_billing)}</span>
        </div>
      </div>

      {/* ---------- Earnings calendar (compact) ---------- */}
      <div className="mt-3 mb-1.5 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Earnings calendar</h3>
        <span className="text-xs font-bold text-brand">{rupeeAmt(monthPayout)}</span>
      </div>
      <Card className="!p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <button onClick={() => shift(-1)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <Icon.back width={16} height={16} />
          </button>
          <div className="text-sm font-bold text-slate-700">{monthTitle}</div>
          <button onClick={() => shift(1)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <Icon.chevron width={16} height={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400">
          {WEEKDAYS.map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = key(view.y, view.m, d);
            const day = byDate.get(k);
            const isSel = k === selected;
            const isToday = k === todayKey;
            return (
              <button key={i} onClick={() => day && setSelected(k)} disabled={!day}
                className={cx(
                  "flex h-8 flex-col items-center justify-center rounded-md text-[11px] leading-none transition",
                  day ? "cursor-pointer" : "cursor-default",
                  isSel ? "bg-brand text-white shadow-sm"
                    : day ? "bg-brand-50 text-brand-dark hover:bg-brand-100"
                    : "text-slate-300",
                  isToday && !isSel && "ring-1 ring-brand/40"
                )}>
                <span className={cx("font-semibold", day && !isSel && "text-slate-600")}>{d}</span>
                {day && <span className={cx("text-[8px] font-bold leading-none", isSel ? "text-white" : "text-brand")}>{compact(day.payout)}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {/* ---------- Selected day detail (compact) ---------- */}
      {sel && (
        <Card className="mt-2 !p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">
              {prettyDate(selected)}
              {sel.target_hit && <span className="ml-1.5 rounded-full bg-ok-light px-1.5 py-0.5 text-[9px] font-bold uppercase text-ok">10%</span>}
            </span>
            <span className="text-base font-extrabold text-brand">{rupeeAmt(sel.payout)}</span>
          </div>
          <div className="mt-1.5 space-y-1">
            {sel.jobs.map((j) => (
              <div key={j.ticket_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                <span className="min-w-0 flex-1 truncate text-slate-500">
                  {j.parts.map((p) => BRAND_LABEL[p.brand] || p.brand).join(", ")}
                  <span className={cx("ml-1.5 capitalize", j.payment_mode === "online" ? "text-warn" : "text-slate-400")}>· {j.payment_mode}</span>
                </span>
                <b className="ml-2 text-slate-700">{rupeeAmt(j.payout)}</b>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
