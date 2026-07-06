import { NavLink } from "react-router-dom";
import { STATUS_META, STEPS } from "../lib/workflow.js";

export const cx = (...a) => a.filter(Boolean).join(" ");

/* ----------------------------- Icons (inline) ---------------------------- */
const I = (p) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  ...p,
});
export const Icon = {
  phone: (p) => (
    <svg {...I(p)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
  ),
  map: (p) => (
    <svg {...I(p)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>
  ),
  bell: (p) => (
    <svg {...I(p)}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
  ),
  wifi: (p) => (
    <svg {...I(p)}><path d="M5 13a10 10 0 0 1 14 0" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M2 8.82a15 15 0 0 1 20 0" /><line x1="12" y1="20" x2="12" y2="20" /></svg>
  ),
  chevron: (p) => (<svg {...I(p)}><path d="m9 18 6-6-6-6" /></svg>),
  search: (p) => (<svg {...I(p)}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>),
  plus: (p) => (<svg {...I(p)}><path d="M12 5v14M5 12h14" /></svg>),
  chevronDown: (p) => (<svg {...I(p)}><path d="m6 9 6 6 6-6" /></svg>),
  back: (p) => (<svg {...I(p)}><path d="m15 18-6-6 6-6" /></svg>),
  check: (p) => (<svg {...I(p)}><path d="M20 6 9 17l-5-5" /></svg>),
  checkCircle: (p) => (<svg {...I(p)}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>),
  pin: (p) => (<svg {...I(p)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>),
  clock: (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>),
  camera: (p) => (<svg {...I(p)}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>),
  mic: (p) => (<svg {...I(p)}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>),
  qr: (p) => (<svg {...I(p)}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v7M17 20h4" /></svg>),
  trash: (p) => (<svg {...I(p)}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>),
  home: (p) => (<svg {...I(p)}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>),
  star: (p) => (<svg {...I({ fill: "currentColor", stroke: "none", ...p })}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" /></svg>),
  help: (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12" y2="17" /></svg>),
  truck: (p) => (<svg {...I(p)}><path d="M10 17h4V5H2v12h2" /><path d="M14 9h4l4 4v4h-2" /><circle cx="7.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></svg>),
  alert: (p) => (<svg {...I(p)}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" /></svg>),
  spark: (p) => (<svg {...I(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>),
  wrench: (p) => (<svg {...I(p)}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.4-2.4z" /></svg>),
  logout: (p) => (<svg {...I(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>),
  wallet: (p) => (<svg {...I(p)}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></svg>),
};

/* --------------------------------- Tags --------------------------------- */
const TAG_TONE = {
  "Warranty": "info",
  "Warranty Active": "ok",
  "AMC Active": "ok",
  "Senior Citizen": "warn",
  "High Priority": "warn",
  "Urgent": "danger",
  "Repeat Complaint": "danger",
  "Payment Pending": "danger",
  "No AMC": "muted",
};
const TONE_CLASS = {
  info: "bg-brand-50 text-brand-dark",
  ok: "bg-ok-light text-ok",
  warn: "bg-warn-light text-warn",
  danger: "bg-danger-light text-danger",
  muted: "bg-slate-100 text-slate-500",
  brand: "bg-brand-50 text-brand-dark",
};
export const Tag = ({ children }) => (
  <span className={cx("rounded-full px-2.5 py-1 text-xs font-medium", TONE_CLASS[TAG_TONE[children] || "muted"])}>
    {children}
  </span>
);

export const StatusPill = ({ status }) => {
  const m = STATUS_META[status] || { label: status, tone: "muted" };
  return (
    <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", TONE_CLASS[m.tone])}>
      {m.label}
    </span>
  );
};

/* ------------------------------ Primitives ------------------------------ */
export const SectionLabel = ({ children, right }) => (
  <div className="mt-5 mb-2 flex items-center justify-between">
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{children}</h3>
    {right}
  </div>
);

export const Card = ({ children, className }) => (
  <div className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-card", className)}>{children}</div>
);

export const PrimaryButton = ({ children, className, ...rest }) => (
  <button
    {...rest}
    className={cx(
      "flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-[15px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50",
      className
    )}
  >
    {children}
  </button>
);

export const GhostButton = ({ children, className, ...rest }) => (
  <button
    {...rest}
    className={cx(
      "flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition active:scale-[0.99]",
      className
    )}
  >
    {children}
  </button>
);

export const Field = ({ label, hint, children }) => (
  <label className="block">
    <div className="mb-1 text-sm font-medium text-slate-600">{label}</div>
    {children}
    {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
  </label>
);

export const input =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand-50";

/* -------------------------------- Stepper ------------------------------- */
export const Stepper = ({ currentIndex, onStep }) => (
  <div className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto pb-1">
    {STEPS.map((s, i) => {
      const done = i < currentIndex;
      const active = i === currentIndex;
      const clickable = onStep && done; // completed steps are tappable to go back & edit
      return (
        <div key={s.key} className="flex shrink-0 items-center">
          <div
            onClick={clickable ? () => onStep(i) : undefined}
            className={cx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              active && "bg-brand text-white",
              done && "bg-ok-light text-ok",
              !active && !done && "bg-slate-100 text-slate-400",
              clickable && "cursor-pointer"
            )}
          >
            <span className={cx("grid h-4 w-4 place-items-center rounded-full text-[10px]", active ? "bg-white/25" : done ? "bg-ok text-white" : "bg-slate-300 text-white")}>
              {done ? <Icon.check width={11} height={11} strokeWidth={3} /> : i + 1}
            </span>
            {s.label}
          </div>
          {i < STEPS.length - 1 && <span className="mx-0.5 h-px w-3 bg-slate-200" />}
        </div>
      );
    })}
  </div>
);

/* -------------------------------- Shell --------------------------------- */
// Centers the app in a phone-width column so it looks right on desktop too.
export const Shell = ({ children }) => (
  <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-slate-100 shadow-pop">
    {children}
  </div>
);

export const BottomNav = () => {
  const item = "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium";
  const cls = ({ isActive }) => cx(item, isActive ? "text-brand" : "text-slate-400");
  return (
    <nav className="sticky bottom-0 z-10 flex border-t border-slate-200 bg-white/95 backdrop-blur">
      <NavLink to="/home" className={cls}><Icon.home /> Home</NavLink>
      <NavLink to="/reviews" className={cls}><Icon.star width={20} height={20} /> Reviews</NavLink>
      {/* Earnings tab hidden for now — re-enable when needed:
      <NavLink to="/earnings" className={cls}><Icon.wallet width={20} height={20} /> Earnings</NavLink> */}
    </nav>
  );
};
