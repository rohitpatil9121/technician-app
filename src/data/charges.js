// M3 redesign: the bill is CALL TYPE (data for the office) + a freeform
// SERVICE CHARGE (any amount, or Free) — independent of each other.
// `charge` ids still ride to the backend for CHARGE_LABELS / CHARGE_FREE compat.
// The four the technician picks from, in the owner's order (6 Oct 2026). "Other"
// asks him to type what the call was.
export const CALL_TYPES = [
  { id: "installation", icon: "install", tone: "amber", label: "Installation", sub: "New machine fit" },
  { id: "warranty", icon: "shield", tone: "green", label: "Warranty", sub: "Under warranty" },
  { id: "service", icon: "wrench", tone: "blue", label: "Paid Service", sub: "Normal paid service" },
  { id: "other", icon: "wrench", tone: "purple", label: "Other", sub: "Type what the call is" },
];
// Not picked by hand any more: a call raised with the Revisit button arrives as
// one, and only such a call shows it as a fifth choice.
export const REVISIT_TYPE = { id: "repeat", icon: "repeat", tone: "purple", label: "Revisit", sub: "Free revisit" };
export const ALL_CALL_TYPES = [...CALL_TYPES, REVISIT_TYPE];

// Shipped defaults. The live values come from GET /api/tech/config (set on the
// dashboard → Settings); these only apply before the first successful fetch.
export const SVC_PRESETS = [0, 250, 350];
export const SERVICE_CHARGE = 250;
// Installation has no single price: ₹250 on an organic lead, ₹350 on a Kent
// lead, and the technician picks. null = do not pre-fill; the office can set a
// fixed figure on the dashboard if that ever changes.
export const INSTALLATION_CHARGE = null;
export const SVC_STEP = 50;
export const SVC_MAX = 1000;

// Merge what the office set over the shipped defaults. Any field the server
// did not send (older backend, or never configured) keeps its default.
export function billConfig(config) {
  const c = config || {};
  const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : d);
  const presets = Array.isArray(c.service_presets) && c.service_presets.length ? c.service_presets : SVC_PRESETS;
  return {
    serviceCharge: num(c.service_charge, SERVICE_CHARGE),
    installationCharge: c.installation_charge == null || c.installation_charge === "" ? INSTALLATION_CHARGE : num(c.installation_charge, INSTALLATION_CHARGE),
    presets,
    max: Math.max(num(c.service_max, SVC_MAX), ...presets),
    upiId: c.upi_id || "",
    upiPayee: c.upi_payee || "",
  };
}

// Old builds and the dashboard still read `work.charge`; keep the old flat
// list so finished jobs written by them render their bill labels.
export const chargeTypes = [
  { id: "service", label: "Service Charge (repair done)", amount: 250 },
  { id: "visit", label: "Visit Charge (no repair)", amount: 250 },
  { id: "warranty", label: "No Charge (Under Warranty)", amount: 0 },
  { id: "repeat", label: "Revisit (within 7 days)", amount: 0 },
  { id: "installation", label: "Installation", amount: 250 },
];
