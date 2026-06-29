import { useJobs } from "../store/JobsContext.jsx";
import { technician } from "../data/mock.js";
import { todayLabel } from "../lib/format.js";
import { Icon, cx } from "./ui.jsx";

// Top bar shown on Home / Reviews / Help (the tabbed screens).
export default function AppHeader({ title }) {
  const { online, setOnline, user, reviews, live } = useJobs();
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
          <button className="relative text-slate-600" aria-label="Notifications">
            <Icon.bell width={22} height={22} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />
          </button>
        </div>
      </div>
      {title && <h1 className="mt-2 text-2xl font-extrabold text-slate-800">{title}</h1>}
    </header>
  );
}
