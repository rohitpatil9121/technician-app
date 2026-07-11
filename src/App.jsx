import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useJobs } from "./store/JobsContext.jsx";
import { registerPush } from "./lib/push.js";
import { startLocationTracking, stopLocationTracking } from "./lib/location.js";
import { getBootResumePath } from "./lib/jobDraft.js";
import PullRefresh from "./components/PullRefresh.jsx";
import { Shell, BottomNav, Skeleton } from "./components/ui.jsx";
import Login from "./screens/Login.jsx";
import Home from "./screens/Home.jsx";

const JobDetail = lazy(() => import("./screens/JobDetail.jsx"));
const Reviews = lazy(() => import("./screens/Reviews.jsx"));

const isHomeLike = (path) => path === "/" || path === "/home";

function Tabbed({ children }) {
  const { loadJobs, loadReviews, live } = useJobs();
  const refresh = async () => {
    await loadJobs({ background: true });
    if (live) await loadReviews?.();
  };
  return (
    <Shell>
      <PullRefresh onRefresh={live ? refresh : undefined} className="flex-1 px-4 pb-4">
        {children}
      </PullRefresh>
      <BottomNav />
    </Shell>
  );
}

export default function App() {
  const { loggedIn } = useJobs();
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => {
    if (loggedIn) {
      registerPush((ticketId) => nav(`/job/${ticketId}`));
      startLocationTracking();
    } else {
      stopLocationTracking();
    }
  }, [loggedIn, nav]);

  // Camera reload often lands on / or /home — jump back before Home paints.
  useEffect(() => {
    if (!loggedIn) return;
    const resume = () => {
      const path = getBootResumePath();
      if (path && loc.pathname !== path) nav(path, { replace: true });
    };
    resume();
    if (!Capacitor.isNativePlatform()) return;
    let sub;
    CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) resume(); })
      .then((h) => { sub = h; })
      .catch(() => {});
    return () => sub?.remove?.();
  }, [loggedIn, nav, loc.pathname]);

  if (!loggedIn && loc.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  // Synchronous guard — runs on first paint after WebView reload (before Routes flash Home).
  if (loggedIn && isHomeLike(loc.pathname)) {
    const boot = getBootResumePath();
    if (boot) return <Navigate to={boot} replace />;
  }

  return (
    <Routes>
      <Route path="/" element={loggedIn ? <Navigate to="/home" replace /> : <Login />} />
      <Route path="/home" element={<Tabbed><Home /></Tabbed>} />
      <Route path="/reviews" element={<Tabbed><Suspense fallback={<ScreenLoader />}><Reviews /></Suspense></Tabbed>} />
      <Route path="/job/:id" element={<Shell><Suspense fallback={<ScreenLoader />}><JobDetail /></Suspense></Shell>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

function ScreenLoader() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
