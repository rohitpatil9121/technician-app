import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { technician } from "../data/mock.js";
import { todayLabel } from "../lib/format.js";
import { Icon, cx } from "./ui.jsx";

// Build the technician's notification list from their jobs — newest concerns
// first. No backend/push needed: it's derived from the loaded jobs.
function useNotifications(jobs) {
  return useMemo(() => {
    const items = [];
    for (const j of jobs || []) {
      if (j.status === "NEW")
        items.push({ id: j.id, icon: "alert", tone: "brand", title: "New job assigned", sub: `${j.name} • ${j.area}` });
      else if (j.status === "ESTIMATE_SENT")
        items.push({ id: j.id, icon: "clock", tone: "warn", title: "Waiting for customer approval", sub: `${j.name} • estimate sent` });
      else if (j.status !== "CLOSED")
        items.push({ id: j.id, icon: "truck", tone: "muted", title: "Job in progress", sub: `${j.name} • ${j.area}` });
    }
    // New + approval-pending are the ones that truly need attention.
    const unread = items.filter((i) => i.tone !== "muted").length;
    return { items, unread };
  }, [jobs]);
}

const TONE_BG = {
  brand: "bg-brand-50 text-brand-dark",
  warn: "bg-warn-light text-warn",
  muted: "bg-slate-100 text-slate-500",
};

// Top bar shown on Home / Reviews (the tabbed screens).
export default function AppHeader({ title }) {
  const { online, setOnline, user, reviews, live, logout, jobs } = useJobs();
  const nav = useNavigate();
  const [bellOpen, setBellOpen] = useState(false);
  const { items, unread } = useNotifications(jobs);
  const name = user?.full_name || technician.name;
  const rating = live ? reviews?.average ?? "—" : technician.rating;

  return (
    <header className="sticky top-0 z-10 bg-slate-100/95 px-4 pb-2 pt-3 backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">{todayLabel()}</div>
          <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-800">
            {name}
            <span className="flex items-center gap-0.5 text-amber-500">
              <Icon.star width={14} height={14} />
              <span className="text-xs font-bold">{rating}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Icon.wifi width={18} height={18} className={online ? "text-ok" : "text-slate-300"} />
          <button
            onClick={() => setOnline((v) => !v)}
            aria-label="Toggle availability"
            className={cx(
              "relative h-6 w-11 rounded-full transition",
              online ? "bg-ok" : "bg-slate-300"
            )}
          >
            <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", online ? "left-[22px]" : "left-0.5")} />
          </button>
          <button onClick={() => setBellOpen((v) => !v)} className="relative text-slate-600" aria-label="Notifications">
            <Icon.bell width={22} height={22} />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />}
          </button>
          <button
            onClick={() => { if (window.confirm("Log out of the app?")) logout(); }}
            aria-label="Log out"
            className="text-slate-500 hover:text-danger"
          >
            <Icon.logout width={20} height={20} />
          </button>
        </div>
      </div>
      {title && <h1 className="mt-2 text-2xl font-extrabold text-slate-800">{title}</h1>}

      {/* Notifications dropdown */}
      {bellOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
          <div className="absolute right-4 top-14 z-30 max-h-[70vh] w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-pop">
            <div className="px-2 py-1.5 text-sm font-bold text-slate-800">Notifications</div>
            {items.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-slate-400">You're all caught up 🎉</div>
            ) : (
              items.map((n, i) => {
                const I = Icon[n.icon];
                return (
                  <button
                    key={n.id + i}
                    onClick={() => { setBellOpen(false); nav(`/job/${n.id}`); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                  >
                    <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-full", TONE_BG[n.tone])}>
                      <I width={16} height={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-700">{n.title}</div>
                      <div className="truncate text-xs text-slate-400">{n.sub}</div>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </header>
  );
}
