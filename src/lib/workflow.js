// The fixed job lifecycle. Order matters — the stepper renders this array.
export const STEPS = [
  { key: "accept", label: "Accept" },
  { key: "travel", label: "Travel" },
  { key: "arrive", label: "Arrive" },
  { key: "diagnose", label: "Diagnose" },
  { key: "estimate", label: "Estimate" },
  { key: "approval", label: "Approval" },
  { key: "workdone", label: "Work Done" },
  { key: "payment", label: "Payment" },
  { key: "complete", label: "Complete" },
];

// Which step a status sits on (the step the technician acts on next).
const STATUS_STEP = {
  NEW: 0,
  ACCEPTED: 1,
  ON_THE_WAY: 2,
  ARRIVED: 3,
  DIAGNOSED: 4,
  ESTIMATE_SENT: 5,
  VERIFIED: 6,
  REJECTED: 7, // rejected estimate skips Work Done → visit-charge-only payment
  WORK_DONE: 7,
  PAID: 8,
  CLOSED: 9,
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
