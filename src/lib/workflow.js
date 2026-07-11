// The simplified 3-step job lifecycle. Order matters — the stepper renders this
// array. The older fine-grained statuses still exist (and map below) so jobs
// mid-flow resume on the right step.
export const STEPS = [
  { key: "accept", label: "Accept" },
  { key: "service", label: "Diagnose & Estimate" },
  { key: "close", label: "Payment & Close" },
];

// Which step a status sits on (the step the technician acts on next).
const STATUS_STEP = {
  NEW: 0,
  ACCEPTED: 1,
  ON_THE_WAY: 1,
  ARRIVED: 1,
  DIAGNOSED: 1,
  ESTIMATE_SENT: 2,
  VERIFIED: 2,
  REJECTED: 2,
  WORK_DONE: 2,
  PAID: 2,
  CLOSED: 3,
};

export const stepIndexForStatus = (status) =>
  STATUS_STEP[status] ?? 0;

// Pretty label + colour tone for the status pill.
export const STATUS_META = {
  NEW: { label: "New", tone: "brand" },
  ACCEPTED: { label: "Accepted", tone: "brand" },
  ON_THE_WAY: { label: "On the way", tone: "warn" },
  ARRIVED: { label: "Arrived", tone: "brand" },
  DIAGNOSED: { label: "Diagnosed", tone: "brand" },
  ESTIMATE_SENT: { label: "Estimate sent", tone: "warn" },
  VERIFIED: { label: "Verified", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "danger" },
  WORK_DONE: { label: "Work done", tone: "ok" },
  PAID: { label: "Paid", tone: "ok" },
  CLOSED: { label: "Closed", tone: "ok" },
};

// Left accent stripe on job cards.
export const STATUS_STRIPE = {
  NEW: "border-l-brand",
  ACCEPTED: "border-l-brand",
  ON_THE_WAY: "border-l-warn",
  ARRIVED: "border-l-brand-light",
  DIAGNOSED: "border-l-brand",
  ESTIMATE_SENT: "border-l-warn",
  VERIFIED: "border-l-ok",
  REJECTED: "border-l-danger",
  WORK_DONE: "border-l-ok",
  PAID: "border-l-ok",
  CLOSED: "border-l-ok",
};
