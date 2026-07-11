import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { jobsSeed, partsCatalog as mockParts, reviews as mockReviews } from "../data/mock.js";
import { App } from "@capacitor/app";
import { api, getToken, setToken, STATUS_TO_ACTION } from "../lib/api.js";

const JobsContext = createContext(null);
const POLL_MS = 30000;
const RESUME_DEBOUNCE_MS = 1500;

const jobsSig = (list) =>
  (list || []).map((j) => `${j.id}:${j.status}:${j.work?.tech_status || ""}`).join("|");

export function JobsProvider({ children }) {
  const [live, setLive] = useState(() => !!getToken());
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  const [jobs, setJobs] = useState(() => (getToken() ? [] : jobsSeed.map((j) => ({ ...j, work: {} }))));
  const [parts, setParts] = useState(mockParts);
  const [reviews, setReviews] = useState(mockReviews);
  const [user, setUser] = useState(null);
  const [online, setOnlineState] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  const hasJobsRef = useRef(false);

  const loadJobs = useCallback(async ({ background = false } = {}) => {
    if (!getToken()) return;
    if (!background && !hasJobsRef.current) setJobsLoading(true);
    try {
      const { jobs: rows } = await api.jobs();
      setJobs((prev) => (jobsSig(prev) === jobsSig(rows) ? prev : rows));
      hasJobsRef.current = true;
    } catch (e) { console.error("loadJobs:", e.message); }
    finally {
      if (!background) setJobsLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { reviews: next } = await api.reviews();
      if (next) {
        setReviews((prev) => {
          const a = JSON.stringify(prev);
          const b = JSON.stringify(next);
          return a === b ? prev : next;
        });
      }
    } catch (e) { console.error("loadReviews:", e.message); }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    loadJobs();
    loadReviews();
    api.me().then(({ user: u }) => u && setUser(u)).catch(() => {});
    api.parts().then(({ parts: p }) => p?.length && setParts(p)).catch(() => {});
  }, [loadJobs, loadReviews]);

  useEffect(() => {
    if (!loggedIn) return;
    let reviewTick = 0;
    let resumeTimer;
    const refreshJobs = () => loadJobs({ background: true });
    const refreshAll = () => {
      refreshJobs();
      loadReviews();
    };
    const scheduleResumeRefresh = () => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(refreshAll, RESUME_DEBOUNCE_MS);
    };

    const timer = setInterval(() => {
      refreshJobs();
      reviewTick += 1;
      if (reviewTick % 2 === 0) loadReviews();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleResumeRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", scheduleResumeRefresh);

    let appSub;
    App.addListener("appStateChange", ({ isActive }) => { if (isActive) scheduleResumeRefresh(); })
      .then((h) => { appSub = h; })
      .catch(() => {});

    return () => {
      clearInterval(timer);
      clearTimeout(resumeTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", scheduleResumeRefresh);
      appSub?.remove?.();
    };
  }, [loggedIn, loadJobs, loadReviews]);

  const startLive = useCallback(async (token, u) => {
    setToken(token);
    setLive(true);
    setLoggedIn(true);
    if (u) setUser(u);
    await loadJobs();
    await loadReviews();
    api.parts().then(({ parts: p }) => p?.length && setParts(p)).catch(() => {});
  }, [loadJobs, loadReviews]);

  const startDemo = useCallback(() => {
    setToken(null);
    setLive(false);
    setJobs(jobsSeed.map((j) => ({ ...j, work: {} })));
    setParts(mockParts);
    setReviews(mockReviews);
    setLoggedIn(true);
    hasJobsRef.current = true;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setLive(false);
    setLoggedIn(false);
    setUser(null);
    setJobs([]);
    hasJobsRef.current = false;
  }, []);

  const getJob = useCallback((id) => jobs.find((j) => j.id === id), [jobs]);

  const setJob = useCallback(
    (job) => setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j))),
    []
  );

  const updateJob = useCallback((id, patch) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id ? { ...j, ...patch, work: { ...j.work, ...(patch.work || {}) } } : j
      )
    );
    if (live && patch.status && STATUS_TO_ACTION[patch.status]) {
      api
        .step(id, STATUS_TO_ACTION[patch.status], patch.work || {})
        .then(({ job }) => setJobs((prev) => prev.map((j) => (j.id === id ? job : j))))
        .catch((e) => { console.error("step:", e.message); loadJobs({ background: true }); });
    }
  }, [live, loadJobs]);

  const setOnline = useCallback((v) => {
    setOnlineState((prev) => {
      const next = typeof v === "function" ? v(prev) : v;
      if (live) api.setOnline(next).catch(() => {});
      return next;
    });
  }, [live]);

  const value = useMemo(
    () => ({
      jobs, parts, reviews, user, online, jobsLoading, setOnline, loggedIn, live,
      startLive, startDemo, logout, updateJob, getJob, setJob, loadJobs, loadReviews,
    }),
    [jobs, parts, reviews, user, online, jobsLoading, loggedIn, live, logout, loadJobs, loadReviews, setOnline, updateJob, getJob, setJob, startLive, startDemo]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export const useJobs = () => {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used inside <JobsProvider>");
  return ctx;
};
