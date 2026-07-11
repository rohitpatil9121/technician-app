import { useEffect } from "react";
import AppHeader from "../components/AppHeader.jsx";
import { useJobs } from "../store/JobsContext.jsx";
import { Icon, SectionLabel, Card, cx } from "../components/ui.jsx";

const LABEL_TONE = {
  Excellent: "bg-ok-light text-ok border-ok/20",
  Good: "bg-brand-50 text-brand-dark border-brand/20",
  Okay: "bg-warn-light text-warn border-warn/20",
  Fair: "bg-warn-light text-warn border-warn/20",
  Poor: "bg-danger-light text-danger border-danger/20",
};

const BORDER_TONE = {
  5: "border-l-ok",
  4: "border-l-brand-light",
  3: "border-l-warn",
  2: "border-l-warn",
  1: "border-l-danger",
};

const Stars = ({ n, size = 14 }) => (
  <span className="flex text-amber-400">
    {Array.from({ length: 5 }).map((_, i) => (
      <Icon.star key={i} width={size} height={size} className={i < n ? "" : "text-slate-200"} />
    ))}
  </span>
);

const initials = (name) =>
  (name || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "C";

const relDate = (iso) => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function Reviews() {
  const { reviews: r, live, loadReviews } = useJobs();

  useEffect(() => {
    if (live) loadReviews?.();
  }, [live, loadReviews]);

  const hasRatings = (r.jobsRated ?? 0) > 0;
  const avg = r.average ?? 0;
  const showTip = hasRatings && avg < 4.8;

  return (
    <>
      <AppHeader title="My Reviews" />

      {/* Hero — average + star row */}
      <div className="mt-1 rounded-2xl bg-gradient-to-br from-brand-light to-brand-dark p-4 text-white shadow-pop">
        <div>
          <div className="text-sm text-white/85">Your average rating</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-4xl font-extrabold">{avg || "—"}</span>
            {hasRatings && <Stars n={Math.round(avg)} size={18} />}
          </div>
          <div className="mt-1 text-xs text-white/70">
            {hasRatings ? `${r.jobsRated} customer rating${r.jobsRated === 1 ? "" : "s"}` : "No ratings yet"}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["This week", hasRatings && r.thisWeek ? `${r.thisWeek}★` : "—"],
            ["Jobs rated", r.jobsRated ?? 0],
            ["5★ jobs", r.fiveStar ?? 0],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/15 py-2">
              <div className="text-[11px] text-white/80">{l}</div>
              <div className="text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Star breakdown */}
      {hasRatings && r.distribution?.length > 0 && (
        <>
          <SectionLabel>Rating breakdown</SectionLabel>
          <Card className="!py-3">
            {r.distribution.map(({ stars, count }) => (
              <div key={stars} className="mb-2 flex items-center gap-2 last:mb-0">
                <span className="w-7 text-xs font-medium text-slate-500">{stars}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${r.jobsRated ? (count / r.jobsRated) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-5 text-right text-xs text-slate-400">{count}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Best / lowest — only when multiple ratings exist */}
      {hasRatings && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-ok/20 bg-ok-light p-3">
            <div className="text-xs text-slate-500">Best rating</div>
            <div className="text-xl font-extrabold text-ok">{r.topStreak}★</div>
          </div>
          <div className="rounded-2xl border border-warn/20 bg-warn-light p-3">
            <div className="text-xs text-slate-500">Lowest rating</div>
            <div className="text-xl font-extrabold text-warn">{r.needsWork}★</div>
          </div>
        </div>
      )}

      {r.categories?.length > 0 && (
        <>
          <SectionLabel>What customers rated you on</SectionLabel>
          {r.categories.map((c) => (
            <Card key={c.label} className="mb-2 flex items-center justify-between !py-3">
              <span className="text-sm text-slate-700">{c.label}</span>
              <span className="flex items-center gap-1 font-bold text-amber-500">
                <Icon.star width={14} height={14} /> {c.score}
              </span>
            </Card>
          ))}
        </>
      )}

      <SectionLabel>Recent feedback</SectionLabel>
      {r.recent?.length > 0 ? (
        r.recent.map((f, i) => (
          <Card
            key={f.ticket || i}
            className={cx("mb-2 !py-3 border-l-4", BORDER_TONE[f.stars] || "border-l-slate-200")}
          >
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-dark">
                {initials(f.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-800">{f.name}</div>
                    {f.ticket && (
                      <div className="text-[11px] text-slate-400">{f.ticket}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <Stars n={f.stars} />
                    {(f.at || f.label) && (
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {f.at ? relDate(f.at) : ""}
                      </div>
                    )}
                  </div>
                </div>
                {(f.label || f.text) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {f.label && (
                      <span className={cx(
                        "rounded-full border px-2 py-0.5 text-xs font-semibold",
                        LABEL_TONE[f.label] || "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {f.label}
                      </span>
                    )}
                    {f.text && (
                      <span className="text-sm text-slate-600">{f.text}</span>
                    )}
                  </div>
                )}
                {!f.label && !f.text && f.stars >= 4 && (
                  <div className="mt-2 text-xs text-slate-400">Customer rated via WhatsApp</div>
                )}
              </div>
            </div>
          </Card>
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center">
          <Icon.star width={32} height={32} className="mx-auto text-slate-200" />
          <div className="mt-2 text-sm font-medium text-slate-500">No ratings yet</div>
          <div className="mt-1 text-xs text-slate-400">
            Complete jobs — customers rate you on WhatsApp after closure.
          </div>
        </div>
      )}

      {showTip && (
        <div className="mt-3 rounded-2xl border border-ok/20 bg-ok-light p-3">
          <div className="flex items-center gap-1.5 font-semibold text-ok">
            <Icon.spark width={16} height={16} /> Push your rating to 4.8★
          </div>
          <div className="text-sm text-slate-600">
            Better ratings unlock higher incentives. Focus on on-time arrival and first-time fix.
          </div>
        </div>
      )}

      {hasRatings && avg >= 4.8 && (
        <div className="mt-3 rounded-2xl border border-ok/20 bg-ok-light p-3">
          <div className="flex items-center gap-1.5 font-semibold text-ok">
            <Icon.spark width={16} height={16} /> Great work!
          </div>
          <div className="text-sm text-slate-600">
            You're maintaining an excellent rating. Keep it up!
          </div>
        </div>
      )}

      <div className="h-2" />
    </>
  );
}
