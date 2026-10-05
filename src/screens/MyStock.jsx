import { useEffect, useState, useCallback } from "react";
import AppHeader from "../components/AppHeader.jsx";
import { useJobs } from "../store/JobsContext.jsx";
import { api } from "../lib/api.js";
import { Icon, Card, cx } from "../components/ui.jsx";

/* My Stock — the parts the office has issued to this technician, and how many
   he should still be carrying.

   For each part: how many he was given, how many have gone onto bills, how many
   he has handed back, and what is left with him. The office issues and takes
   returns from the dashboard; this screen only shows it, so he and the office
   are counting from the same list. */

const CACHE_KEY = "og-stock-v1";
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } };
const writeCache = (v) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* storage full — skip */ } };
const day = (iso) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

export default function MyStock() {
  const { live } = useJobs();
  const [data, setData] = useState(readCache);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await api.myStock();
      setData(next); writeCache(next); setErr("");
    } catch (e) { setErr(e.message || "Couldn't load"); }
  }, []);

  useEffect(() => { if (live) load(); }, [live, load]);

  const items = data?.items || [];
  const kinds = items.filter((i) => i.in_hand > 0).length;

  return (
    <>
      <AppHeader />
      <div className="mb-2.5 mt-1 text-[30px] font-extrabold tracking-tight text-strong">My Stock</div>

      {err && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-warn-light px-3 py-2.5">
          <Icon.alert width={16} height={16} className="shrink-0 text-warn" />
          <span className="flex-1 text-[13px] text-strong">
            {data ? "Showing the last saved list — you may be offline." : "Couldn't load your stock — you may be offline."}
          </span>
          <button type="button" onClick={load} className="shrink-0 rounded-full bg-warn px-3 py-1 text-[12px] font-bold text-white">Retry</button>
        </div>
      )}

      <Card className="!rounded-[20px] !p-[18px]">
        <div className="text-sm font-medium text-muted">Parts with you</div>
        <div className="tnum mt-0.5 text-[44px] font-extrabold leading-none tracking-tight text-strong">{data?.in_hand ?? (data ? 0 : "—")}</div>
        <div className="mt-1.5 text-[13px] text-muted">
          {items.length
            ? <>{kinds} kind{kinds === 1 ? "" : "s"} of part{data?.since ? <> · issued since {day(data.since)}</> : null}</>
            : data ? "Nothing is issued to you right now." : "Loading…"}
        </div>
      </Card>

      {data && !items.length && (
        <div className="mt-3 rounded-2xl bg-tonal px-4 py-3.5 text-[14px] text-muted">
          When the office gives you parts from the store, they show here with how many are left with you.
        </div>
      )}

      {items.map((i) => (
        <Card key={i.id} className={cx("mt-2.5", i.in_hand === 0 && "opacity-60")}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-bold leading-snug text-strong">{i.name}</div>
              <div className="tnum mt-1 text-[13px] text-muted">
                Issued {i.issued} · Used {i.used}{i.returned > 0 ? ` · Returned ${i.returned}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={cx("tnum text-[28px] font-extrabold leading-none", i.in_hand > 0 ? "text-brand" : "text-muted")}>{i.in_hand}</div>
              <div className="mt-0.5 text-[11.5px] font-medium text-muted">with you</div>
            </div>
          </div>
        </Card>
      ))}

      {items.length > 0 && (
        <div className="mt-3 px-1 text-[12.5px] text-subtle">
          Used = parts you put on bills since they were issued. If a count looks wrong, tell the office.
        </div>
      )}

      <div className="h-6" />
    </>
  );
}
