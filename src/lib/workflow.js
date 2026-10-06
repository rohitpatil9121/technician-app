// The 5-milestone job flow: Reach → Details → Bill → Payment → Close.
//
// "Close" (owner, 7 Oct 2026) is where the call is finished once the money is
// in: the technician's remark for the customer, the customer's own remark, the
// reason for a small bill, and the Service Done button. A job sits on it from
// the moment its payment is recorded (PAID) until he presses that button.
//
// "Work" used to sit between Bill and Payment as a fifth milestone, but it only
// ever said "do the repair, then press the button" — a screen technicians tapped
// straight through, so the owner had it removed. The WORK_DONE write it carried
// still happens: the Bill screen's "Collect Payment" records it on the way past,
// which keeps work_done_at on the ticket and the customer's "work finished,
// amount due" WhatsApp going out exactly as before.
//
// Older fine-grained statuses still map below so jobs written mid-flow by
// previous builds resume correctly.
export const STEPS = [
  { key: "reach", label: "Reach", icon: "pin" },
  { key: "details", label: "Details", icon: "drop" },
  { key: "bill", label: "Bill", icon: "receipt" },
  { key: "payment", label: "Payment", icon: "bag" },
  { key: "close", label: "Close", icon: "checkCircle" },
];

// Which milestone a status sits on (the one the technician acts on next).
const STATUS_STEP = {
  NEW: 0,
  ACCEPTED: 0,
  ON_THE_WAY: 0,
  ARRIVED: 1,
  DIAGNOSED: 2,
  // Legacy states from the removed WhatsApp-approval flow — land on Bill so the
  // technician can re-send or start the work in person.
  ESTIMATE_SENT: 2,
  REJECTED: 2,
  // VERIFIED means the estimate went out and work started. With Work gone that
  // is no longer a screen of its own, so — like WORK_DONE — it resumes on
  // Payment. A job parked at VERIFIED by an older build lands there too.
  VERIFIED: 3,
  WORK_DONE: 3,
  PAID: 4,
  CLOSED: 5,
};

export const stepIndexForStatus = (status) =>
  STATUS_STEP[status] ?? 0;

// Pretty label + colour tone for the status pill.
export const STATUS_META = {
  NEW: { label: "New", tone: "brand" },
  ACCEPTED: { label: "Accepted", tone: "brand" },
  ON_THE_WAY: { label: "On the way", tone: "warn" },
  ARRIVED: { label: "Arrived", tone: "brand" },
  DIAGNOSED: { label: "Making bill", tone: "brand" },
  ESTIMATE_SENT: { label: "Bill made", tone: "warn" },
  VERIFIED: { label: "Working", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "danger" },
  WORK_DONE: { label: "Collect payment", tone: "warn" },
  PAID: { label: "Paid", tone: "ok" },
  CLOSED: { label: "Complete", tone: "ok" },
};
