// M3 redesign: the bill is CALL TYPE (data for the office) + a freeform
// SERVICE CHARGE (any amount, or Free) — independent of each other.
// `charge` ids still ride to the backend for CHARGE_LABELS / CHARGE_FREE compat.
export const CALL_TYPES = [
  { id: "service", icon: "wrench", tone: "blue", label: "Service", sub: "Normal paid service" },
  { id: "warranty", icon: "shield", tone: "green", label: "Warranty / AMC", sub: "Under warranty or AMC" },
  { id: "repeat", icon: "repeat", tone: "purple", label: "Repeat Call", sub: "Same problem in 7 days" },
  { id: "installation", icon: "install", tone: "amber", label: "Installation", sub: "New machine fit" },
];

// Shipped defaults. The live values come from GET /api/tech/config (set on the
// dashboard → Settings); these only apply before the first successful fetch.
export const SVC_PRESETS = [0, 250, 350];
export const SERVICE_CHARGE = 250;
// Fixed price for a new-machine fit (same figure on the portal and the public
// price list). Picked automatically when the Installation call type is chosen.
export const INSTALLATION_CHARGE = 350;
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
    installationCharge: num(c.installation_charge, INSTALLATION_CHARGE),
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
  { id: "repeat", label: "Repeat Call (within 7 days)", amount: 0 },
  { id: "installation", label: "Installation", amount: 350 },
];
