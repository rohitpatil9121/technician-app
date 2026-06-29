import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { technician, repeatCalls, escalations } from "../data/mock.js";
import AppHeader from "../components/AppHeader.jsx";
import JobCard from "../components/JobCard.jsx";
import { Icon, SectionLabel, cx } from "../components/ui.jsx";

function Stat({ icon, label, value }) {
  return (
    <div className="flex-1 rounded-xl bg-white/15 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-white/80">{icon} {label}</div>
      <div className="text-2xl font-extrabold leading-tight">{value}</div>
    </div>
  );
}

export default function Home() {
  const { jobs, user, reviews, live } = useJobs();
  const nav = useNavigate();
  const firstName = (user?.full_name || technician.name).split(" ")[0];
  const rating = live ? reviews?.average ?? "—" : technician.rating;

  const closed = jobs.filter((j) => j.status === "CLOSED");
  const pending = jobs.filter((j) => j.bucket === "pending" && j.status !== "CLOSED");
  const today = jobs.filter((j) => j.bucket === "today" && j.status !== "CLOSED");

  return (
    <>
      <AppHeader />

      {/* Hero */}
      <div className="mt-1 rounded-2xl bg-gradient-to-br from-brand-light to-brand-dark p-4 text-white shadow-pop">
        <div className="text-sm text-white/85">Namaste 🙏</div>
        <div className="flex items-center gap-2 text-xl font-extrabold">
          {firstName}, ready for today?
          <span className="flex items-center gap-0.5 rounded-full bg-white/15 px-2 py-0.5 text-sm">
            <Icon.star width={14} height={14} /> {rating}
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <Stat icon={<Icon.clock width={13} height={13} />} label="Pending" value={pending.length} />
          <Stat icon={<Icon.truck width={13} height={13} />} label="Today" value={today.length} />
          <Stat icon={<Icon.checkCircle width={13} height={13} />} label="Done today" value={closed.length} />
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <SectionLabel>Pending from previous days</SectionLabel>
          {pending.map((j) => <JobCard key={j.id} job={j} />)}
        </>
      )}

      <SectionLabel>Today's jobs</SectionLabel>
      {today.length > 0 ? (
        today.map((j) => <JobCard key={j.id} job={j} />)
      ) : (
        <EmptyRow text="No open jobs for today." />
      )}

      <SectionLabel>Completed today</SectionLabel>
      {closed.length > 0 ? (
        closed.map((j) => <JobCard key={j.id} job={j} />)
      ) : (
        <EmptyRow text="None closed yet today" />
      )}

      {!live && <>
      <SectionLabel>Repeat calls (within 10 days)</SectionLabel>
      {repeatCalls.map((r) => (
        <button
          key={r.id + r.days}
          onClick={() => nav(`/job/${r.id}`)}
          className="mb-2 w-full rounded-2xl border border-danger/20 bg-danger-light/40 p-3 text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Icon.spark width={15} height={15} className="text-danger" /> {r.name}
            </div>
            <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
              REPEAT • {r.days}D
            </span>
          </div>
          <div className="text-xs text-slate-500">{r.area} • {r.model}</div>
          <div className="mt-0.5 text-sm text-slate-700">{r.issue}</div>
          <div className="mt-1 text-xs text-slate-400">
            No charge: customer not billed again within 10-day window.
          </div>
        </button>
      ))}

      <SectionLabel>Escalations</SectionLabel>
      {escalations.map((e) => (
        <div key={e.id} className="mb-2 rounded-2xl border border-danger/20 bg-danger-light/40 p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-slate-800">{e.name}</div>
            <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">URGENT</span>
          </div>
          <div className="text-xs text-slate-500">{e.area}</div>
          <div className="mt-0.5 text-sm text-slate-700">{e.note}</div>
        </div>
      ))}
      </>}
      <div className="h-2" />
    </>
  );
}

const EmptyRow = ({ text }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-400">
    {text}
  </div>
);
