import { useState } from "react";
import AppHeader from "../components/AppHeader.jsx";
import { helpGuides, helpScripts } from "../data/mock.js";
import { Icon, SectionLabel, GhostButton, cx } from "../components/ui.jsx";

function Accordion({ title, body, icon }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon} {title}
        </span>
        <Icon.chevronDown width={18} height={18} className={cx("text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open && <div className="animate-in px-4 pb-3 text-sm text-slate-600">{body}</div>}
    </div>
  );
}

export default function Help() {
  return (
    <>
      <AppHeader title="Help &amp; Support" />

      <div className="mt-1 grid grid-cols-2 gap-2">
        <GhostButton className="!flex-col !gap-1 !rounded-2xl !bg-brand !text-white !py-3 !border-brand">
          <Icon.phone width={18} height={18} /> Service Manager
        </GhostButton>
        <GhostButton className="!flex-col !gap-1 !rounded-2xl !py-3">
          <Icon.phone width={18} height={18} /> Office
        </GhostButton>
      </div>

      <div className="mt-2 flex items-center justify-between rounded-2xl border border-danger/20 bg-danger-light p-3">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-danger">
            <Icon.alert width={16} height={16} /> Emergency Support
          </div>
          <div className="text-xs text-slate-500">Field accident, dispute, theft</div>
        </div>
        <button className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white">Call</button>
      </div>

      <SectionLabel>Common issue guide</SectionLabel>
      {helpGuides.map((g) => (
        <Accordion key={g.title} title={g.title} body={g.body} />
      ))}

      <SectionLabel right={<Icon.spark width={16} height={16} className="text-brand" />}>
        What to say to customer
      </SectionLabel>
      {helpScripts.map((s) => (
        <Accordion key={s.title} title={s.title} body={s.body} icon={<Icon.help width={16} height={16} className="text-brand" />} />
      ))}
      <div className="h-2" />
    </>
  );
}
