import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { App } from "@capacitor/app";
import { api, getToken, setToken, setUnauthorizedHandler, STATUS_TO_ACTION } from "../lib/api.js";
import { queuedStep, startSync, setJobSink, onOutboxChange } from "../lib/sync.js";
import {
  loadCachedJobs, cacheJobs, clearCachedJobs,
  loadCachedParts, cacheParts, clearCachedParts,
  loadCachedReviews, cacheReviews, clearCachedReviews,
} from "../lib/jobCache.js";

const JobsContext = createContext(null);
const POLL_MS = 30000;
const RESUME_DEBOUNCE_MS = 1500;

const jobsSig = (list) =>
  (list || []).map((j) => `${j.id}:${j.status}:${j.work?.tech_status || ""}`).join("|");

export function JobsProvider({ children }) {
  const [live, setLive] = useState(() => !!getToken());
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  const [jobs, setJobs] = useState(() => loadCachedJobs());
  const [parts, setParts] = useState(loadCachedParts);
  const [reviews, setReviews] = useState(loadCachedReviews);
  const [user, setUser] = useState(null);
  const [online, setOnlineState] = useState(true);
  const [jobsLoading, setJobsLoading] = useState(false);
  /* Why the last job load failed, or null.

     It used to go to console.error and nowhere else. HomeV2 has always had an
     error panel with a Try again button, but nothing ever filled it in, so a
     technician whose phone had dropped off the network — or whose seven-day
     session had quietly expired — was shown "No open jobs for today". Reading
     that as "the office has given me nothing" is the obvious thing to do, and
     it is wrong every time. */
  const [jobsError, setJobsError] = useState(null);
  const hasJobsRef = useRef(false);

  const loadJobs = useCallback(async ({ background = false } = {}) => {
    if (!getToken()) return;
    if (!background && !hasJobsRef.current) setJobsLoading(true);
    try {
      const { jobs: rows } = await api.jobs();
      setJobs((prev) => (jobsSig(prev) === jobsSig(rows) ? prev : rows));
      hasJobsRef.current = true;
      setJobsError(null);
    } catch (e) {
      console.error("loadJobs:", e.message);
      // Cached jobs stay on screen and keep working offline; the banner only
      // says the list may be out of date. With nothing cached there is nothing
      // to show but the error, which is the honest answer.
      setJobsError(e.message || "Could not reach the server");
    }
    finally {
      if (!background) setJobsLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { reviews: next } = await api.reviews();
      if (next) {
        cacheReviews(next);
        setReviews((prev) => {
          const a = JSON.stringify(prev);
          const b = JSON.stringify(next);
          return a === b ? prev : next;
        });
      }
    } catch (e) { console.error("loadReviews:", e.message); }
  }, []);

  /* Who is signed in. Asked for once on boot and, if that one call failed, again
     on the next poll — a single dropped request used to leave the header reading
     "Namaste, Technician" for the whole session, because nothing ever asked a
     second time. */
  const userRef = useRef(null);
  const ensureUser = useCallback(async () => {
    if (userRef.current || !getToken()) return;
    try {
      const { user: u } = await api.me();
      if (u) { userRef.current = u; setUser(u); }
    } catch { /* the next poll tries again */ }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    loadJobs();
    loadReviews();
    ensureUser();
    api.parts().then(({ parts: p }) => { if (p?.length) { setParts(p); cacheParts(p); } }).catch(() => {});
  }, [loadJobs, loadReviews, ensureUser]);

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
      ensureUser();
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
  }, [loggedIn, loadJobs, loadReviews, ensureUser]);

  const startLive = useCallback(async (token, u) => {
    setToken(token);
    setLive(true);
    setLoggedIn(true);
    if (u) setUser(u);
    await loadJobs();
    await loadReviews();
    api.parts().then(({ parts: p }) => { if (p?.length) { setParts(p); cacheParts(p); } }).catch(() => {});
  }, [loadJobs, loadReviews]);

  const logout = useCallback(() => {
    setToken(null);
    setLive(false);
    setLoggedIn(false);
    setUser(null);
    userRef.current = null; // next sign-in must fetch the new technician
    setJobs([]);
    // Wipe the offline copy too — the next technician to log in on this phone
    // must not see the previous one's jobs.
    clearCachedJobs();
    clearCachedParts();
    clearCachedReviews();
    hasJobsRef.current = false;
  }, []);

  // An expired or rejected token ends the session here, the same as tapping
  // Log out — the app stops pretending to be signed in and shows the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Keep the last server list on the device: with no signal the technician must
  // still see today's jobs instead of an empty screen.
  useEffect(() => { cacheJobs(jobs); }, [jobs]);

  // Replay anything written while offline, and fold the synced job back in.
  const [pendingSync, setPendingSync] = useState(0);
  useEffect(() => {
    setJobSink((job) => setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j))));
    const off = onOutboxChange(setPendingSync);
    startSync();
    return off;
  }, []);

  const getJob = useCallback((id) => jobs.find((j) => j.id === id), [jobs]);

  const setJob = useCallback(
    (job) => setJobs((prev) => prev.map((j) => (j.id === job.id ? job : j))),
    []
  );

  // "New Call": drop a freshly created job into the list without a full reload.
  const addJob = useCallback(
    (job) => setJobs((prev) => (prev.some((j) => j.id === job.id) ? prev : [job, ...prev])),
    []
  );

  const updateJob = useCallback((id, patch) => {
    // `action` overrides the status→action mapping for steps where the backend
    // lands on a different status than the one we show optimistically (sending
    // the estimate puts the job straight into VERIFIED / work started).
    const { action, ...jobPatch } = patch;
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id ? { ...j, ...jobPatch, work: { ...j.work, ...(jobPatch.work || {}) } } : j
      )
    );
    const step = action || (patch.status && STATUS_TO_ACTION[patch.status]);
    if (!live || !step) return Promise.resolve();
    // Returned so callers can await the write landing. Tapping "Reached" fires
    // this and the arrival-OTP request; letting them overlap raced two writes
    // to the same job and the OTP lost.
    return queuedStep(id, step, patch.work || {})
      .then((res) => { if (res?.job) setJobs((prev) => prev.map((j) => (j.id === id ? res.job : j))); })
      .catch((e) => { console.error("step:", e.message); loadJobs({ background: true }); });
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
      jobs, parts, reviews, user, online, jobsLoading, jobsError, setOnline, loggedIn, live, pendingSync,
      startLive, logout, updateJob, getJob, setJob, addJob, loadJobs, loadReviews,
    }),
    [jobs, parts, reviews, user, online, jobsLoading, jobsError, loggedIn, live, pendingSync, logout, loadJobs, loadReviews, setOnline, updateJob, getJob, setJob, addJob, startLive]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export const useJobs = () => {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used inside <JobsProvider>");
  return ctx;
};
