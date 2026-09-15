import { NavLink } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { STATUS_META, STEPS } from "../lib/workflow.js";
import { rupeeAmt } from "../lib/format.js";
import { lookup } from "../lib/photoCache.js";

export const cx = (...a) => a.filter(Boolean).join(" ");

/* Count a number up to its target with an ease-out — gives money a premium feel.
   Honours reduced-motion and snaps instantly when the value is unchanged.

   Correctness beats the animation here: this renders the amount the technician
   collects cash against. requestAnimationFrame does not run while the WebView is
   backgrounded — and this app backgrounds it on every camera shot — so a value
   that changes meanwhile would otherwise stay visibly stale. Any path that can't
   animate snaps straight to the real number. */
function useCountUp(target, ms = 550) {
  const goal = Number(target) || 0;
  const [val, setVal] = useState(goal);
  const fromRef = useRef(goal);
  useEffect(() => {
    const start = fromRef.current;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (reduce || hidden || start === goal) { setVal(goal); fromRef.current = goal; return; }
    let raf, t0;
    const tick = (now) => {
      t0 ??= now;
      const p = Math.min(1, (now - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(start + (goal - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = goal;
    };
    raf = requestAnimationFrame(tick);
    // Interrupted mid-count (value changed again, or unmounted): land on the
    // true figure rather than leaving whatever frame we stopped on.
    return () => { cancelAnimationFrame(raf); fromRef.current = goal; setVal(goal); };
  }, [goal, ms]);
  return val;
}

/* Rupee amount that animates when it changes (estimate total, amount due, …). */
export const RupeeCount = ({ value, className }) => (
  <span className={className}>{rupeeAmt(useCountUp(value))}</span>
);

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
  whatsapp: (p) => (<svg {...I({ fill: "currentColor", stroke: "none", ...p })}><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.69.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35zM12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 7 2.9 9.83 9.83 0 0 1 2.89 7c0 5.45-4.44 9.87-9.9 9.87zm8.42-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.59 5.95L.06 24l6.3-1.65a11.9 11.9 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.47-8.41z" /></svg>),
  moon: (p) => (<svg {...I(p)}><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" /></svg>),
  sun: (p) => (
    <svg {...I(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  ),
  wallet: (p) => (<svg {...I(p)}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4z" /></svg>),
  /* M3 redesign icons (mockup set) */
  drop: (p) => (<svg {...I(p)}><path d="M12 2.7S5 9.5 5 14a7 7 0 0 0 14 0c0-4.5-7-11.3-7-11.3z" /></svg>),
  shield: (p) => (<svg {...I(p)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>),
  repeat: (p) => (<svg {...I(p)}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>),
  install: (p) => (<svg {...I(p)}><path d="M12 3v10m0 0 4-4m-4 4-4-4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>),
  cash: (p) => (<svg {...I(p)}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></svg>),
  phoneupi: (p) => (<svg {...I(p)}><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" /></svg>),
  split: (p) => (<svg {...I(p)}><path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7" /></svg>),
  receipt: (p) => (<svg {...I(p)}><path d="M5 3v18l2.5-1.5L10 21l2-1.5L14 21l2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5 5 3z" /><path d="M9 8h6M9 12h6" /></svg>),
  eye: (p) => (<svg {...I(p)}><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" /></svg>),
  person: (p) => (<svg {...I(p)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>),
  image: (p) => (<svg {...I(p)}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>),
  bag: (p) => (<svg {...I(p)}><path d="M6 8h12l1 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>),
  minus: (p) => (<svg {...I(p)}><path d="M5 12h14" /></svg>),
  gear: (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H2.9a2 2 0 0 1 0-4H3a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 3V2.9a2 2 0 0 1 4 0V3a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 9h.1a2 2 0 0 1 0 4H21a1.6 1.6 0 0 0-1.6 2z" /></svg>),
  filter: (p) => (<svg {...I(p)}><path d="M22 4H2l8 9.2V20l4-2v-4.8L22 4z" /></svg>),
  sad: (p) => (<svg {...I(p)}><circle cx="12" cy="12" r="9" /><path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01" /></svg>),
  key: (p) => (<svg {...I(p)}><circle cx="7.5" cy="15.5" r="4" /><path d="M10.3 12.7 20 3l1.5 1.5-1.5 1.5 1.5 1.5-2 2-1.5-1.5-2 2" /></svg>),
  walk: (p) => (<svg {...I(p)}><circle cx="13" cy="4" r="1.6" /><path d="M11 21l1.5-5L10 13l1-5 3 2 2.5 1M10 8l-2 4M12.5 16 10 21" /></svg>),
};

/* Coloured icon square (mockup .ichip). tone: blue|green|amber|red|purple|gray */
const ICHIP_BG = { blue: "bg-brand", green: "bg-ok", amber: "bg-warn", red: "bg-danger", purple: "bg-accent", gray: "bg-subtle" };
/* `className` is how a caller centres it: the chip is display:grid and so
   block-level, which a parent's text-center cannot pull in — pass "mx-auto"
   inside a centred card. */
export const IconChip = ({ tone = "blue", size = 38, radius = 10, className, children }) => (
  <span
    className={cx("grid shrink-0 place-items-center text-white", ICHIP_BG[tone], className)}
    style={{ width: size, height: size, borderRadius: radius }}
    aria-hidden="true"
  >
    {children}
  </span>
);

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
/* Tints are opacity-over-surface rather than fixed light hexes, so one set of
   classes works in both themes; the paired text colour is the `fg` token. */
const TONE_CLASS = {
  info: "bg-brand/10 text-brand-fg",
  ok: "bg-ok/10 text-ok-fg",
  warn: "bg-warn/10 text-warn-fg",
  danger: "bg-danger/10 text-danger-fg",
  muted: "bg-muted/10 text-muted",
  brand: "bg-brand/10 text-brand-fg",
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
    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{children}</h3>
    {right}
  </div>
);

/* M3 card: 16px radius, tonal elevation, no border (mockup .card). */
export const Card = ({ children, className }) => (
  <div className={cx("rounded-2xl bg-surface p-4 shadow-card", className)}>{children}</div>
);

/* Mockup .flabel — card field label with leading icon. */
export const FLabel = ({ icon: Ic, must, children }) => (
  <div className="mb-2.5 flex items-center gap-2 text-[16px] font-semibold text-strong">
    {Ic && <Ic width={18} height={18} className="text-muted" aria-hidden="true" />}
    {children}
    {must && <span className="rounded-md bg-danger-tint px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-danger-fg">MUST</span>}
  </div>
);

/* Material 3 basic dialog (mockup .alert): 28px radius, left-aligned, text
   actions bottom-right. Renders above everything; Escape/backdrop close. */
export const MDialog = ({ icon, iconClass, title, children, actions, onClose }) => (
  <>
    <div className="animate-backdrop fixed inset-0 z-50 bg-black/35" onClick={onClose} />
    <div role="alertdialog" aria-modal="true" aria-label={title}
      className="animate-scale-in-centered fixed left-1/2 top-[44%] z-50 w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-surface shadow-pop">
      <div className="px-6 pb-3 pt-6">
        {icon && <div className={cx("mb-3.5 grid h-11 w-11 place-items-center rounded-full", iconClass)}>{icon}</div>}
        <div className="text-[22px] font-semibold leading-tight text-strong">{title}</div>
        {children && <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>}
      </div>
      <div className="flex justify-end gap-1.5 px-4 pb-4 pt-1">{actions}</div>
    </div>
  </>
);

/* Text action inside an MDialog. */
export const MDialogBtn = ({ danger, bold, children, ...rest }) => (
  <button
    {...rest}
    className={cx(
      "min-h-[44px] rounded-full px-4 text-sm font-semibold",
      danger ? "text-danger" : "text-brand",
      bold && "font-bold"
    )}
  >
    {children}
  </button>
);

/* Material 3 bottom sheet (mockup .sheet): 28px top corners, grab handle. */
export const MSheet = ({ title, onClose, children, footer }) => (
  <>
    <div className="animate-backdrop fixed inset-0 z-40 bg-black/35" onClick={onClose} />
    <div role="dialog" aria-modal="true" aria-label={title}
      className="animate-sheet fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[84%] w-full max-w-[440px] flex-col rounded-t-[28px] bg-surface shadow-pop">
      <div className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-hair" aria-hidden="true" />
      <div className="flex items-center justify-between px-4 pb-3 pt-1.5">
        <div className="text-[19px] font-extrabold tracking-tight text-strong">{title}</div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full bg-tonal text-muted">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">{children}</div>
      {footer && <div className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-2">{footer}</div>}
    </div>
  </>
);

/* ± price stepper (mockup .stepper) — tonal pill, bounded. */
/* `compact` shrinks the control so a rate + quantity + line total still fit on
   ONE row inside a part card on a 360dp phone. Buttons stay at 40px, which is
   below the 44px comfort target but still a reliable tap area — the alternative
   was wrapping the line total onto its own row, which read as a second, unrelated
   number. Everywhere else keeps the roomier default. */
export const PlusMinus = ({ value, onDelta, onInput, step = 50, min = 0, max = Infinity, format = (v) => v, wide, compact }) => {
  /* With onInput the centre value is also typeable: raw digits while focused,
     formatted (₹…) when not.

     The typed number is committed on every keystroke, NOT on blur. Committing on
     blur lost the last edit whenever the next tap was the thing that ended it:
     blur fires first and only schedules the parent's state update, so the ± button
     or the Save button the finger actually landed on still ran against the value
     from before it was typed. Typing 500 and tapping + gave 300; typing 500 and
     tapping Save Bill saved the old amount while the field showed the new one.
     `editing` is now only what is on screen while focused — the parent is always
     already up to date. */
  const [editing, setEditing] = useState(null);
  const type = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 7);
    setEditing(digits);
    onInput(Math.max(min, Math.min(max, Number(digits) || 0)));
  };
  const btn = compact ? "h-10 w-10" : "h-11 w-11";
  const mid = compact ? "w-[34px]" : wide ? "w-[74px]" : "w-[60px]";
  const midStatic = compact ? "min-w-[34px]" : wide ? "min-w-[74px]" : "min-w-[60px]";
  return (
    <div className="flex shrink-0 items-center overflow-hidden rounded-full bg-tonal">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onDelta(-step)}
        className={cx("grid place-items-center text-brand disabled:text-hair", btn)}>
        <Icon.minus width={18} height={18} />
      </button>
      {onInput ? (
        <input type="text" inputMode="numeric" aria-label="Amount"
          className={cx("tnum bg-transparent text-center text-[15px] font-bold text-strong outline-none", mid)}
          value={editing != null ? editing : format(value)}
          onFocus={(e) => { setEditing(value ? String(value) : ""); e.target.select(); }}
          onChange={(e) => type(e.target.value)}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
      ) : (
        <span className={cx("tnum text-center text-[15px] font-bold text-strong", midStatic)}>{format(value)}</span>
      )}
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onDelta(step)}
        className={cx("grid place-items-center text-brand disabled:text-hair", btn)}>
        <Icon.plus width={18} height={18} />
      </button>
    </div>
  );
};

export const Skeleton = ({ className }) => (
  <div className={cx("skeleton", className)} aria-hidden="true" />
);

/* A job photo that survives having no signal.

   Uploaded photos are rendered from the URL the server gave them, which means
   fetching an image back down that the phone took and still has. Offline that
   fetch just fails and the technician sees empty squares where his own
   photos were. On failure we fall back to the copy photoCache kept.

   The network is still tried first: the cache holds only what THIS phone
   uploaded, so a photo from a colleague, or one taken before the app was
   reinstalled, must still come from the server. */
export const JobPhoto = ({ src, alt, className }) => {
  const [shown, setShown] = useState(src);
  useEffect(() => { setShown(src); }, [src]);
  return (
    <img
      src={shown}
      alt={alt}
      className={className}
      onError={() => { lookup(src).then((local) => { if (local) setShown(local); }); }}
    />
  );
};

export const SkeletonJobCard = () => (
  <div className="mb-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
    <div className="flex justify-between">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="mt-2 h-3 w-40" />
    <Skeleton className="mt-3 h-4 w-full" />
    <Skeleton className="mt-1 h-3 w-24" />
    <div className="mt-3 grid grid-cols-3 gap-2">
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
    </div>
  </div>
);

export const EmptyState = ({ icon: I, title, sub }) => (
  <div className="rounded-2xl border border-dashed border-line bg-surface/60 px-4 py-8 text-center">
    {I && <I width={32} height={32} className="mx-auto text-subtle/50" aria-hidden="true" />}
    <div className="mt-2 text-sm font-medium text-muted">{title}</div>
    {sub && <div className="mt-1 text-xs text-subtle">{sub}</div>}
  </div>
);

/* Material 3 filled button — full pill, 56px, the mockup's .btn.big. Use
   className "!bg-ok" for the green "go" variant. */
export const PrimaryButton = ({ children, className, loading, disabled, ...rest }) => (
  <button
    {...rest}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cx(
      "flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-[17px] font-semibold tracking-[0.1px] text-white shadow-sm transition",
      "active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
  >
    {loading && <Spinner />}
    {children}
  </button>
);

/* Material 3 tonal button — primary-container fill, pill (.btn.ghost). */
export const GhostButton = ({ children, className, ...rest }) => (
  <button
    {...rest}
    className={cx(
      "flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-brand-tint px-4 text-[15px] font-semibold tracking-[0.1px] text-brand-dark transition",
      "active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
  >
    {children}
  </button>
);

export const Spinner = ({ className }) => (
  <svg className={cx("animate-spin", className)} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Field = ({ label, hint, required, children }) => (
  <label className="block">
    <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted">
      {label}
      {required && <span className="text-[10px] font-bold uppercase tracking-wide text-danger-fg">Required</span>}
    </div>
    {children}
    {hint && <div className="mt-1 text-xs text-subtle">{hint}</div>}
  </label>
);

/* Material filled text field: surface-container fill, top-rounded, underline
   that turns primary on focus (mockup .field). */
export const input =
  "w-full min-h-[52px] rounded-t-lg rounded-b-none border-0 border-b-2 border-subtle bg-tonal px-4 text-[17px] font-medium text-strong placeholder:text-subtle outline-none transition focus:border-brand";

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
            aria-current={active ? "step" : undefined}
            className={cx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-300",
              active && "bg-brand text-white",
              done && "bg-ok/10 text-ok-fg",
              !active && !done && "bg-muted/10 text-subtle",
              clickable && "cursor-pointer"
            )}
          >
            {/* text-surface, not text-white: on the light --text-subtle chip in
                dark mode, white scored 2.9:1. */}
            <span className={cx("grid h-4 w-4 place-items-center rounded-full text-[10px] transition-colors duration-300", active ? "bg-white/25" : done ? "bg-ok text-white" : "bg-subtle text-surface")}>
              {done ? <Icon.check width={11} height={11} strokeWidth={3} /> : i + 1}
            </span>
            {s.label}
          </div>
          {i < STEPS.length - 1 && <span className={cx("mx-0.5 h-px w-3 transition-colors duration-300", i < currentIndex ? "bg-ok/50" : "bg-line")} />}
        </div>
      );
    })}
  </div>
);

/* -------------------------------- Shell --------------------------------- */
// Centers the app in a phone-width column so it looks right on desktop too.
export const Shell = ({ children }) => (
  <div className="safe-x mx-auto flex h-screen min-h-0 w-full max-w-[440px] flex-col overflow-hidden bg-sunken shadow-pop">
    {children}
  </div>
);

/* Material 3 navigation bar: surface-container-high, active tab gets a
   primary-container pill behind its icon (mockup .tabs/.tab). */
export const BottomNav = () => {
  const cls = ({ isActive }) =>
    cx(
      "flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 pt-2.5 pb-3 text-[11px] transition-colors",
      isActive ? "font-bold text-strong" : "font-semibold text-muted"
    );
  const Pill = ({ active, children }) => (
    <span className={cx("grid place-items-center rounded-full px-[18px] py-1 transition-colors", active && "bg-brand-tint text-brand-dark")}>
      {children}
    </span>
  );
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-10 flex bg-tonal pb-[env(safe-area-inset-bottom,0px)]">
      <NavLink to="/home" className={cls}>
        {({ isActive }) => (<><Pill active={isActive}><Icon.home width={22} height={22} aria-hidden="true" /></Pill> Home</>)}
      </NavLink>
      <NavLink to="/reviews" className={cls}>
        {({ isActive }) => (<><Pill active={isActive}><Icon.star width={21} height={21} aria-hidden="true" /></Pill> Reviews</>)}
      </NavLink>
    </nav>
  );
};
