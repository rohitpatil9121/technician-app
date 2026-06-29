import AppHeader from "../components/AppHeader.jsx";
import { useJobs } from "../store/JobsContext.jsx";
import { Icon, SectionLabel, Card } from "../components/ui.jsx";

const Stars = ({ n }) => (
  <span className="flex text-amber-400">
    {Array.from({ length: 5 }).map((_, i) => (
      <Icon.star key={i} width={14} height={14} className={i < n ? "" : "text-slate-200"} />
    ))}
  </span>
);

export default function Reviews() {
  const { reviews: r } = useJobs();
  return (
    <>
      <AppHeader title="My Reviews" />

      <div className="mt-1 rounded-2xl bg-gradient-to-br from-brand-light to-brand-dark p-4 text-white shadow-pop">
        <div className="text-sm text-white/85">Your average rating</div>
        <div className="flex items-center gap-1 text-4xl font-extrabold">
          <Icon.star width={28} height={28} /> {r.average}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["This Week", r.thisWeek + "★"],
            ["Jobs Rated", r.jobsRated],
            ["5★ jobs", r.fiveStar],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/15 py-2">
              <div className="text-[11px] text-white/80">{l}</div>
              <div className="text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-ok/20 bg-ok-light p-3">
          <div className="text-xs text-slate-500">Top Rating Streak</div>
          <div className="text-xl font-extrabold text-ok">{r.topStreak}★</div>
        </div>
        <div className="rounded-2xl border border-warn/20 bg-warn-light p-3">
          <div className="text-xs text-slate-500">Needs Improvement</div>
          <div className="text-xl font-extrabold text-warn">{r.needsWork}★</div>
        </div>
      </div>

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
          <Card key={i} className="mb-2 !py-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{f.name}</span>
              <Stars n={f.stars} />
            </div>
            {f.text && <div className="text-sm text-slate-500">{f.text}</div>}
          </Card>
        ))
      ) : (
        <Card className="!py-4 text-center text-sm text-slate-400">No ratings yet.</Card>
      )}

      <div className="mt-3 rounded-2xl border border-ok/20 bg-ok-light p-3">
        <div className="flex items-center gap-1.5 font-semibold text-ok">
          <Icon.spark width={16} height={16} /> Push your rating to 4.8★
        </div>
        <div className="text-sm text-slate-600">
          Better ratings unlock higher incentives automatically. Focus on customer happiness.
        </div>
      </div>
      <div className="h-2" />
    </>
  );
}
