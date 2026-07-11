// Persist job form + route across Android camera/gallery (WebView fully reloads).
// Hash URL (#/job/…) survives reload; localStorage is the backup.

const store = () => (typeof localStorage !== "undefined" ? localStorage : null);

const draftKey = (id) => `og-job-draft:${id}`;
const RESUME_PATH = "og-tech-resume-path";
const PHOTO_BUSY = "og-tech-photo-busy";

/** Keep the hash route in sync so a WebView reload reopens the same job screen. */
export function pinRoute(path) {
  if (!path?.startsWith("/job/")) return;
  setResumePath(path);
  if (typeof window === "undefined") return;
  const hash = `#${path}`;
  if (window.location.hash !== hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }
}

export function loadJobDraft(id) {
  try {
    const raw = store()?.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveJobDraft(id, fields) {
  if (!id) return;
  try {
    store()?.setItem(draftKey(id), JSON.stringify({ ...fields, _ts: Date.now() }));
  } catch { /* quota */ }
}

export function clearJobDraft(id) {
  store()?.removeItem(draftKey(id));
}

export function setResumePath(path) {
  if (path) store()?.setItem(RESUME_PATH, path);
}

export function markPhotoStart(path) {
  store()?.setItem(PHOTO_BUSY, "1");
  pinRoute(path);
}

export function clearPhotoMark() {
  store()?.removeItem(PHOTO_BUSY);
}

export function getBootResumePath() {
  const s = store();
  if (!s || s.getItem(PHOTO_BUSY) !== "1") return null;
  const path = s.getItem(RESUME_PATH);
  return path?.startsWith("/job/") ? path : null;
}

export function leaveJobScreen() {
  clearPhotoMark();
  store()?.removeItem(RESUME_PATH);
}

export function acknowledgeJobResume() {
  clearPhotoMark();
}

/** Re-apply saved draft fields after a WebView reload. */
export function applyJobDraft(draft, setters) {
  if (!draft) return;
  if (draft.problems?.length) setters.setProblems(draft.problems);
  if (draft.parts?.length) setters.setParts(draft.parts);
  if (draft.charge) setters.setCharge(draft.charge);
  if (draft.modelName != null && draft.modelName !== "") setters.setModelName(draft.modelName);
  if (draft.otherText != null) setters.setOtherText(draft.otherText);
  if (draft.tapIn != null && draft.tapIn !== "") setters.setTapIn(draft.tapIn);
  if (draft.filterIn != null && draft.filterIn !== "") setters.setFilterIn(draft.filterIn);
  if (draft.tapOut != null && draft.tapOut !== "") setters.setTapOut(draft.tapOut);
  if (draft.filterOut != null && draft.filterOut !== "") setters.setFilterOut(draft.filterOut);
  if (draft.cashAmt != null && draft.cashAmt !== "") setters.setCashAmt(draft.cashAmt);
}
