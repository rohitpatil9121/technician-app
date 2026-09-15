import { useState } from "react";
import { HomeV2 } from "../screens/HomeV2.jsx";
import { Shell, BottomNav, cx } from "../components/ui.jsx";

/* Side-by-side harness for the Home redesign. Renders with fixed mock data so
   it works without a backend or a logged-in technician. Not shipped — reachable
   only at /#/preview, and safe to delete along with this folder. */

const MOCK = {
  user: { full_name: "Ramesh Patil" },
  reviews: { average: 4.8 },
  jobs: [
    {
      id: "t1", code: "OG-2841", name: "Sunita Deshmukh", status: "NEW", bucket: "today",
      area: "Kothrud", when: "10:30 AM", visitCharge: 0, phone: "9800000001",
      address: "Kothrud, Pune", model: "Kent Grand Plus", tags: ["Warranty Active"],
      issue: "No water coming from the purifier since yesterday morning.",
    },
    {
      id: "t2", code: "OG-2839", name: "Arjun Mehta", status: "ESTIMATE_SENT", bucket: "pending",
      area: "Baner", when: "Yesterday", visitCharge: 350, phone: "9800000002",
      address: "Baner, Pune", model: "Aquaguard Marvel", tags: ["Repeat Complaint"],
      issue: "Filter replacement quoted — waiting for customer to approve the estimate.",
    },
    {
      id: "t3", code: "OG-2843", name: "Priya Nair", status: "ON_THE_WAY", bucket: "today",
      area: "Viman Nagar", when: "1:00 PM", visitCharge: 350, phone: "9800000003",
      address: "Viman Nagar, Pune", model: "Kent Supreme", tags: [],
      issue: "Water tastes odd and there is a slow drip near the tap joint.",
    },
    {
      id: "t4", code: "OG-2836", name: "Vikram Joshi", status: "CLOSED", bucket: "today",
      area: "Aundh", when: "9:00 AM", visitCharge: 350, collected: 1450,
      phone: "9800000004", address: "Aundh, Pune", model: "Kent Grand", rating: 5, issue: "Annual service done.",
    },
    {
      id: "t5", code: "OG-2835", name: "Meera Kulkarni", status: "CLOSED", bucket: "today",
      area: "Shivaji Nagar", when: "8:15 AM", visitCharge: 350, collected: 350,
      phone: "9800000005", address: "Shivaji Nagar, Pune", model: "Aquaguard Enhance", rating: 4, issue: "Leak fixed.",
    },
  ],
};

export default function Preview() {
  const [dark, setDark] = useState(false);
  const [state, setState] = useState("data"); // data | loading | error | empty

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const Btn = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-lg px-3 py-1.5 text-xs font-bold transition",
        active ? "bg-brand text-white" : "bg-surface text-muted border border-line"
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-sunken">
      {/* Every state is reachable from here — the ones that only appear on a
          bad day are the ones that never get designed. */}
      <div className="flex flex-wrap items-center justify-center gap-2 py-3">
        {["data", "loading", "error", "empty"].map((s) => (
          <Btn key={s} active={state === s} onClick={() => setState(s)}>{s}</Btn>
        ))}
        <Btn active={dark} onClick={toggleDark}>{dark ? "Light" : "Dark"}</Btn>
      </div>

      <Shell>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <HomeV2
            jobs={state === "data" ? MOCK.jobs : []}
            user={MOCK.user}
            reviews={MOCK.reviews}
            loading={state === "loading"}
            error={state === "error"}
            onRetry={() => setState("data")}
            onOpen={() => {}}
          />
        </div>
        <BottomNav />
      </Shell>
    </div>
  );
}
