// Sample data for the standalone demo. Structured so it can later be swapped
// for live `/api/tech/*` responses without changing the screens.

export const technician = {
  name: "Ramesh Patil",
  rating: 4.7,
  serviceManagerPhone: "+91 90000 11222",
};

// Catalogue of parts (mirrors backend `stock_items`). Price is the default
// estimate price; technician can edit per job.
export const partsCatalog = [
  { id: "sediment", name: "Sediment Filter", price: 250 },
  { id: "carbon", name: "Carbon Filter", price: 300 },
  { id: "membrane", name: "RO Membrane", price: 1800 },
  { id: "pump", name: "Pump", price: 1400 },
  { id: "sv", name: "SV (Solenoid Valve)", price: 260 },
  { id: "adapter", name: "Adapter", price: 350 },
  { id: "uv", name: "UV Lamp", price: 700 },
  { id: "tubing", name: "Tubing", price: 120 },
  { id: "connector", name: "Connector", price: 60 },
];

export const issueTypes = [
  "Low Flow",
  "No Water",
  "Leakage",
  "Bad Taste",
  "Noise",
  "Electrical Issue",
  "Service Due",
  "Filter Issue",
  "Pump Issue",
  "Membrane Issue",
];

export const chargeTypes = [
  { id: "service", label: "Service Charge (repair done)", amount: 250 },
  { id: "visit", label: "Visit Charge (no repair)", amount: 250 },
  { id: "warranty", label: "No Charge (Under Warranty)", amount: 0 },
  { id: "repeat", label: "Repeat Call (within 7 days)", amount: 0 },
];

// Each job == a ticket assigned to this technician.
export const jobsSeed = [
  {
    id: "J-1001",
    name: "Mr. Joshi",
    phone: "+919812345670",
    area: "Hinjewadi",
    address: "B-302, Megapolis, Hinjewadi Phase 3, Pune 411057",
    when: "Yesterday 4:00 PM",
    bucket: "pending",
    model: "Kent Supreme",
    issue: "Noisy pump, needs replacement",
    lastService: "12 Jan 2026",
    visitCharge: 250,
    tags: ["No AMC", "High Priority", "Payment Pending"],
    status: "ESTIMATE_SENT",
  },
  {
    id: "J-1002",
    name: "Mr. Kulkarni",
    phone: "+919812345671",
    area: "Baner",
    address: "Flat 9, Crystal Residency, Baner Road, Pune 411045",
    when: "Today 10:30 AM",
    bucket: "today",
    model: "Kent RO Grand Plus",
    issue: "Low water flow from purifier",
    lastService: "02 Feb 2026",
    visitCharge: 250,
    tags: ["No AMC", "Payment Pending"],
    status: "NEW",
  },
  {
    id: "J-1003",
    name: "Mrs. Sharma",
    phone: "+919812345672",
    area: "Wakad",
    address: "Flat 7, Rose Icon, Datta Mandir Road, Wakad, Pune 411057",
    when: "Today 12:00 PM",
    bucket: "today",
    model: "Aquaguard RO+UV Marvel",
    issue: "Leakage near storage tank",
    lastService: "04 Mar 2026",
    visitCharge: 0,
    tags: ["Warranty", "High Priority", "Warranty Active"],
    status: "NEW",
  },
  {
    id: "J-1004",
    name: "Mr. Shaikh",
    phone: "+919812345673",
    area: "Pimple Saudagar",
    address: "Sayli Heights, Pimple Saudagar, Pune 411027",
    when: "Today 2:30 PM",
    bucket: "today",
    model: "Livpure RO Pep Pro",
    issue: "Bad taste in water",
    lastService: "20 Dec 2025",
    visitCharge: 250,
    tags: ["No AMC", "Urgent", "Repeat Complaint", "High Priority"],
    status: "NEW",
  },
  {
    id: "J-1005",
    name: "Mrs. Deshpande",
    phone: "+919812345674",
    area: "Kothrud",
    address: "Sahawas Society, Kothrud, Pune 411038",
    when: "Today 5:00 PM",
    bucket: "today",
    model: "Generic RO 10L",
    issue: "Filter change (AMC scheduled)",
    lastService: "28 Mar 2026",
    visitCharge: 0,
    tags: ["AMC Active", "Senior Citizen"],
    status: "NEW",
  },
];

// Read-only home sections built from extra context.
export const repeatCalls = [
  {
    id: "J-1004",
    name: "Mr. Shaikh",
    area: "Pimple Saudagar",
    model: "Livpure RO Pep Pro",
    issue: "Bad taste in water",
    days: 6,
  },
  {
    id: "J-0998",
    name: "Mrs. Naidu",
    area: "Viman Nagar",
    model: "Aquaguard Enhance",
    issue: "Same bad-taste complaint again",
    days: 4,
  },
];

export const escalations = [
  {
    id: "J-1004",
    name: "Mr. Shaikh",
    area: "Pimple Saudagar",
    note: "Repeat complaint — bad taste again after 5 days",
  },
];

export const reviews = {
  average: 4.7,
  thisWeek: 4.8,
  jobsRated: 14,
  fiveStar: 9,
  topStreak: 5,
  needsWork: 3,
  distribution: [
    { stars: 5, count: 9 },
    { stars: 4, count: 3 },
    { stars: 3, count: 1 },
    { stars: 2, count: 0 },
    { stars: 1, count: 1 },
  ],
  categories: [
    { label: "Polite & friendly behaviour", score: 4.9 },
    { label: "First-time fix success", score: 4.8 },
    { label: "On-time arrival", score: 4.6 },
    { label: "Job done properly", score: 4.7 },
    { label: "Clear communication", score: 4.7 },
  ],
  recent: [
    { name: "Mrs. Sharma", stars: 5, label: "Excellent", text: "Very polite. Fixed leak quickly.", at: new Date(Date.now() - 3600000).toISOString(), ticket: "OG-070726-0001" },
    { name: "Mr. Patel", stars: 4, label: "Good", text: "Good service, came on time.", at: new Date(Date.now() - 86400000).toISOString(), ticket: "OG-070725-0012" },
    { name: "Mrs. Iyer", stars: 3, label: "Okay", text: "Repeated complaint after 3 days.", at: new Date(Date.now() - 172800000).toISOString(), ticket: "OG-070724-0008" },
  ],
};

export const helpGuides = [
  {
    title: "Low Flow",
    body: "Check sediment + carbon filters first. Inspect pump pressure and membrane choke. Clean/replace the worst-affected stage.",
  },
  {
    title: "Bad Taste",
    body: "Check carbon filter and membrane TDS reduction. If output TDS is high, replace the membrane.",
  },
  {
    title: "Leakage",
    body: "Inspect tubing joints, connectors and the storage tank seal. Tighten or replace the failing connector/tubing.",
  },
  {
    title: "No Water",
    body: "Check power, SMPS adapter, solenoid valve and pump. Confirm input water supply and inlet valve.",
  },
];

export const helpScripts = [
  {
    title: "How to explain the visit charge",
    body: "The visit charge covers travel + on-site diagnosis. It is waived under warranty / AMC and for a repeat call within 7 days.",
  },
  {
    title: "How to explain TDS reading",
    body: "TDS = dissolved solids in water. We measure input vs output; lower output means cleaner drinking water. We show the after-repair reading as proof.",
  },
  {
    title: "How to ask for estimate approval",
    body: "Share the estimate clearly, explain parts needed, and ask the customer to confirm on WhatsApp before any paid work begins.",
  },
  {
    title: "How to handle an angry customer",
    body: "Listen first, acknowledge the issue, explain the fix and cost calmly. If unresolved, call the Service Manager and let them step in.",
  },
  {
    title: "How to explain feedback request",
    body: "Tell the customer they'll get a short WhatsApp asking how the service was — their feedback helps us serve them better.",
  },
];
