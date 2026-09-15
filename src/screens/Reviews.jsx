import { useEffect } from "react";
import AppHeader from "../components/AppHeader.jsx";
import { useJobs } from "../store/JobsContext.jsx";
import { Icon, Card, cx } from "../components/ui.jsx";

// Ratings are stored numerically (5 = Best, 4 = Good, 1 = Poor; legacy 1–5
// scores map to the nearest level) but customers only ever see the three words.
const levelOf = (n) => (n >= 5 ? "Best" : n >= 3 ? "Good" : "Poor");
const LEVEL_STYLE = {
  Best: "bg-brand-tint text-brand-dark",
  Good: "bg-tonal text-muted",
  Poor: "bg-danger-tint text-danger",
};

const LevelBadge = ({ n, className = "" }) => {
  const word = levelOf(Number(n));
  return (
    <span className={cx("inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-bold", LEVEL_STYLE[word], className)}>
      {word}
    </span>
  );
};

const initials = (name) =>
  (name || "C").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "C";

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

const SecH = ({ children }) => (
  <div className="mx-1 mb-2 mt-5 text-[12.5px] font-semibold uppercase tracking-wide text-muted">{children}</div>
);

export default function Reviews() {
  const { reviews: r, live, loadReviews } = useJobs();

  useEffect(() => {
    if (live) loadReviews?.();
  }, [live, loadReviews]);

  const hasRatings = ((r?.jobsRated) ?? 0) > 0;
  // Group the numeric distribution into the three customer-facing levels.
  const counts = { Best: 0, Good: 0, Poor: 0 };
  for (const { stars, count } of r?.distribution || []) counts[levelOf(Number(stars))] += count;
  const positivePct = hasRatings ? Math.round(((counts.Best + counts.Good) / r.jobsRated) * 100) : 0;

  return (
    <>
      <AppHeader />
      <div className="mb-2.5 mt-1 text-[30px] font-extrabold tracking-tight text-strong">Reviews</div>

      {/* Rating hero (mockup .rvhero) */}
      <Card className="!rounded-[20px] !p-[18px]">
        <div className="text-sm font-medium text-muted">Positive ratings</div>
        <div className="mt-0.5 flex items-end gap-2.5">
          <div className="tnum text-[48px] font-extrabold leading-none tracking-tight text-strong">{hasRatings ? `${positivePct}%` : "—"}</div>
          {hasRatings && <div className="mb-1.5"><LevelBadge n={positivePct >= 80 ? 5 : positivePct >= 50 ? 4 : 1} /></div>}
        </div>
        <div className="mt-4 flex gap-2">
          {[
            [r?.jobsRated ?? 0, "Ratings"],
            [counts.Best, "Best"],
            [hasRatings && r?.thisWeek ? r.thisWeek : "—", "This week"],
          ].map(([v, l]) => (
            <div key={l} className="flex-1 rounded-xl bg-tonal px-2 py-2.5 text-center">
              <div className="tnum text-[19px] font-extrabold text-strong">{v}</div>
              <div className="mt-0.5 text-[11.5px] font-medium text-muted">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      {hasRatings && r.distribution?.length > 0 && (
        <>
          <SecH>Ratings</SecH>
          <Card>
            {["Best", "Good", "Poor"].map((word) => (
              <div key={word} className="mb-2.5 flex items-center gap-2.5 last:mb-0">
                <span className="w-11 text-[13px] font-semibold text-muted">{word}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-tonal">
                  <i className="block h-full rounded-full bg-warn" style={{ width: `${r.jobsRated ? (counts[word] / r.jobsRated) * 100 : 0}%` }} />
                </div>
                <span className="tnum w-6 text-right text-xs text-subtle">{counts[word]}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      <SecH>Recent</SecH>
      {r?.recent?.length > 0 ? (
        r.recent.map((f, i) => (
          <div key={f.ticket || i} className="mt-2.5 flex gap-3 rounded-2xl bg-surface p-3.5 shadow-card">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-tint font-bold text-brand-dark">
              {initials(f.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="truncate text-[15px] font-bold text-strong">{f.name}</div>
                {f.at && <span className="shrink-0 text-[11px] text-subtle">{relDate(f.at)}</span>}
              </div>
              <LevelBadge n={f.stars} className="mt-0.5" />
              {f.text && <div className="mt-1 text-sm text-muted">{f.text}</div>}
            </div>
          </div>
        ))
      ) : (
        <div className="mt-2 rounded-2xl bg-surface px-4 py-8 text-center shadow-card">
          <Icon.star width={32} height={32} className="mx-auto text-hair" aria-hidden="true" />
          <div className="mt-2 text-sm font-medium text-muted">No ratings yet</div>
          <div className="mt-1 text-xs text-subtle">Customers rate you on WhatsApp after each job.</div>
        </div>
      )}
      <div className="h-6" />
    </>
  );
}
