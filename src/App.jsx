import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useJobs } from "./store/JobsContext.jsx";
import { registerPush } from "./lib/push.js";
import { Shell, BottomNav } from "./components/ui.jsx";
import Login from "./screens/Login.jsx";
import Home from "./screens/Home.jsx";
import JobDetail from "./screens/JobDetail.jsx";
import Reviews from "./screens/Reviews.jsx";

// Tabbed screens share the phone shell + bottom nav.
function Tabbed({ children }) {
  return (
    <Shell>
      <main className="flex-1 overflow-y-auto px-4 pb-4">{children}</main>
      <BottomNav />
    </Shell>
  );
}

export default function App() {
  const { loggedIn } = useJobs();
  const loc = useLocation();
  const nav = useNavigate();

  // Once logged in (fresh login or returning user), register for push and route
  // notification taps to the job.
  useEffect(() => {
    if (loggedIn) registerPush((ticketId) => nav(`/job/${ticketId}`));
  }, [loggedIn, nav]);

  if (!loggedIn && loc.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={loggedIn ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/home" element={<Tabbed><Home /></Tabbed>} />
      <Route path="/reviews" element={<Tabbed><Reviews /></Tabbed>} />
      <Route path="/job/:id" element={<Shell><JobDetail /></Shell>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
