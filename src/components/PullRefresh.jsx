import { useRef, useState, useCallback } from "react";
import { cx } from "./ui.jsx";

const THRESHOLD = 52;
const MAX_PULL = 84;

const resist = (dy) => Math.min(Math.pow(Math.max(dy, 0), 0.82) * 0.55, MAX_PULL);

function RefreshIndicator({ pull, busy, ready }) {
  const progress = busy ? 1 : Math.min(pull / THRESHOLD, 1);
  const visible = pull > 6 || busy;

  return (
    <div
      className={cx(
        "flex flex-col items-center justify-end overflow-hidden transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ height: busy ? 52 : Math.max(pull, 0) }}
    >
      <div
        className={cx(
          "grid h-8 w-8 place-items-center rounded-full bg-white shadow-card ring-1 ring-slate-200/60",
          (ready || busy) && "ring-brand/25"
        )}
        style={{ transform: busy ? undefined : `scale(${0.85 + progress * 0.15})` }}
      >
        {busy ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cx("transition-colors", ready ? "text-brand" : "text-slate-400")}
            style={{ transform: `rotate(${ready ? 180 : progress * 140}deg)`, transition: "transform 0.15s ease" }}
          >
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
        )}
      </div>
      {visible && (
        <span
          className={cx(
            "mt-1.5 pb-0.5 text-[11px] font-medium tracking-wide transition-colors",
            busy || ready ? "text-brand" : "text-slate-400"
          )}
        >
          {busy ? "Updating…" : ready ? "Release to refresh" : "Pull down"}
        </span>
      )}
    </div>
  );
}

// Pull-to-refresh for tab screens. Disabled when `onRefresh` is omitted (demo mode).
export default function PullRefresh({ onRefresh, children, className }) {
  const scrollRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef(0);
  const tracking = useRef(false);
  const pullRef = useRef(0);
  const enabled = !!onRefresh;

  const setPullSafe = useCallback((v) => {
    pullRef.current = v;
    setPull(v);
  }, []);

  const onTouchStart = (e) => {
    if (!enabled || busy) return;
    if ((scrollRef.current?.scrollTop ?? 0) <= 1) {
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    }
  };

  const onTouchMove = (e) => {
    if (!tracking.current || !enabled) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullSafe(resist(dy));
      if (dy > 10 && e.cancelable) e.preventDefault();
    } else {
      setPullSafe(0);
      tracking.current = false;
    }
  };

  const finish = async () => {
    if (!tracking.current) return;
    tracking.current = false;
    const p = pullRef.current;
    if (p >= THRESHOLD && enabled) {
      setBusy(true);
      setPullSafe(48);
      try { await onRefresh(); } finally {
        setBusy(false);
        setPullSafe(0);
      }
    } else {
      setPullSafe(0);
    }
  };

  const ready = pull >= THRESHOLD;
  const offset = busy ? 48 : pull * 0.35;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center">
        <RefreshIndicator pull={pull} busy={busy} ready={ready} />
      </div>
      <div
        ref={scrollRef}
        className={cx("min-h-0 flex-1 overflow-y-auto overscroll-y-contain", className)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finish}
        onTouchCancel={finish}
        style={{
          transform: offset ? `translateY(${offset}px)` : undefined,
          transition: offset ? "none" : "transform 0.28s cubic-bezier(0.33, 1, 0.68, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
