import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../store/JobsContext.jsx";
import { Icon, IconChip, MDialog, MDialogBtn, MSheet } from "./ui.jsx";

/* Notifications are derived from the loaded jobs — no backend endpoint. */
function useNotifications(jobs) {
  return useMemo(() => {
    const items = [];
    for (const j of jobs || []) {
      if (j.status === "NEW")
        items.push({ id: j.id, icon: "pin", tone: "blue", title: "New job assigned", sub: `${j.name} · ${j.area}` });
      else if (j.status !== "CLOSED")
        items.push({ id: j.id, icon: "receipt", tone: "amber", title: "Job in progress", sub: `${j.name} · ${j.area}` });
    }
    const unread = items.filter((i) => i.tone === "blue").length;
    return { items, unread };
  }, [jobs]);
}

const initials = (name) =>
  (name || "T").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "T";

/* Material 3 app header (mockup .apphead): Namaste + name,
   notifications, avatar → logout dialog. */
export default function AppHeader() {
  const { user, logout, jobs } = useJobs();
  const nav = useNavigate();
  const [sheet, setSheet] = useState(null); // notif | logout
  const { items, unread } = useNotifications(jobs);
  const name = user?.full_name || "Technician";

  return (
    <>
      <div className="flex items-center justify-between pb-1.5 pt-1">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-wide text-subtle">Namaste</div>
          <div className="truncate text-[26px] font-extrabold tracking-tight text-strong">{name}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" aria-label={`Notifications${unread ? `, ${unread} new` : ""}`}
            onClick={() => setSheet("notif")}
            className="relative grid h-11 w-11 place-items-center rounded-full bg-tonal text-muted">
            <Icon.bell width={19} height={19} />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-sunken bg-danger px-1 text-[10px] font-extrabold text-white">
                {unread}
              </span>
            )}
          </button>
          <button type="button" aria-label="Account"
            onClick={() => setSheet("logout")}
            className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-brand-light to-brand-dark text-[16px] font-extrabold text-white shadow-[0_3px_8px_rgba(11,87,208,.25)]">
            {initials(name)}
          </button>
        </div>
      </div>

      {sheet === "notif" && (
        <MSheet title="Notifications" onClose={() => setSheet(null)}>
          {items.length === 0 && <div className="py-8 text-center text-sm text-subtle">You're all caught up</div>}
          {items.map((n) => {
            const NIc = Icon[n.icon] || Icon.bell;
            return (
              <button key={n.id} type="button"
                onClick={() => { setSheet(null); nav(`/job/${n.id}`); }}
                className="mb-2.5 flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-sunken p-3 text-left">
                <IconChip tone={n.tone}><NIc width={18} height={18} /></IconChip>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-strong">{n.title}</span>
                  <span className="block truncate text-[13px] text-subtle">{n.sub}</span>
                </span>
              </button>
            );
          })}
          <div className="h-4" />
        </MSheet>
      )}
      {sheet === "logout" && (
        <MDialog title="Log out?" onClose={() => setSheet(null)}
          icon={<Icon.logout width={22} height={22} className="text-danger" />} iconClass="bg-danger-tint"
          actions={
            <>
              <MDialogBtn onClick={() => setSheet(null)}>Cancel</MDialogBtn>
              <MDialogBtn danger bold onClick={() => { setSheet(null); logout(); }}>Log Out</MDialogBtn>
            </>
          }>
          You'll need your mobile number and WhatsApp code to log in again.
        </MDialog>
      )}
    </>
  );
}
