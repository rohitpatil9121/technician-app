import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { jobsSeed, partsCatalog as mockParts, reviews as mockReviews } from "../data/mock.js";
import { api, getToken, setToken, STATUS_TO_ACTION } from "../lib/api.js";

const JobsContext = createContext(null);

export function JobsProvider({ children }) {
  const [live, setLive] = useState(() => !!getToken());
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());
  const [jobs, setJobs] = useState(() => (getToken() ? [] : jobsSeed.map((j) => ({ ...j, work: {} }))));
  const [parts, setParts] = useState(mockParts);
  const [reviews, setReviews] = useState(mockReviews);
  const [user, setUser] = useState(null);
  const [online, setOnlineState] = useState(true);

  const loadJobs = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { jobs } = await api.jobs();
      setJobs(jobs);
    } catch (e) { console.error("loadJobs:", e.message); }
  }, []);

  // Returning user (token already stored) → live mode + load data.
  useEffect(() => {
    if (!getToken()) return;
    loadJobs();
    api.me().then(({ user }) => user && setUser(user)).catch(() => {});
    api.parts().then(({ parts }) => parts?.length && setParts(parts)).catch(() => {});
    api.reviews().then(({ reviews }) => reviews && setReviews(reviews)).catch(() => {});
  }, [loadJobs]);

  // Called by Login after a successful OTP verify.
  const startLive = useCallback(async (token, u) => {
    setToken(token);
    setLive(true);
    setLoggedIn(true);
    if (u) setUser(u);
    await loadJobs();
    api.parts().then(({ parts }) => parts?.length && setParts(parts)).catch(() => {});
    api.reviews().then(({ reviews }) => reviews && setReviews(reviews)).catch(() => {});
  }, [loadJobs]);

  // Demo Login → mock data, no backend.
  const startDemo = useCallback(() => {
    setToken(null);
    setLive(false);
    setJobs(jobsSeed.map((j) => ({ ...j, work: {} })));
    setParts(mockParts);
    setReviews(mockReviews);
    setLoggedIn(true);
  }, []);

  // Sign out: drop the token and reset to the logged-out state. The <App>
  // route guard then redirects to the login screen.
  const logout = useCallback(() => {
    setToken(null);
    setLive(false);
    setLoggedIn(false);
    setUser(null);
    setJobs([]);
  }, []);

  const getJob = (id) => jobs.find((j) => j.id === id);

  // Advance a job: optimistic local update, then persist in live mode.
  const updateJob = (id, patch) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id ? { ...j, ...patch, work: { ...j.work, ...(patch.work || {}) } } : j
      )
    );
    if (live && patch.status && STATUS_TO_ACTION[patch.status]) {
      api
        .step(id, STATUS_TO_ACTION[patch.status], patch.work || {})
        .then(({ job }) => setJobs((prev) => prev.map((j) => (j.id === id ? job : j))))
        .catch((e) => { console.error("step:", e.message); loadJobs(); });
    }
  };

  const setOnline = (v) => {
    const next = typeof v === "function" ? v(online) : v;
    setOnlineState(next);
    if (live) api.setOnline(next).catch(() => {});
  };

  const value = useMemo(
    () => ({ jobs, parts, reviews, user, online, setOnline, loggedIn, live, startLive, startDemo, logout, updateJob, getJob, loadJobs }),
    [jobs, parts, reviews, user, online, loggedIn, live, logout, loadJobs]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export const useJobs = () => {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used inside <JobsProvider>");
  return ctx;
};
