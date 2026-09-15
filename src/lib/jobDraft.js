// Persist job form + route across Android camera/gallery (WebView fully reloads).
// Hash URL (#/job/…) survives reload; localStorage is the backup.

const store = () => (typeof localStorage !== "undefined" ? localStorage : null);

const draftKey = (id) => `og-job-draft:${id}`;
const RESUME_PATH = "og-tech-resume-path";
const PHOTO_BUSY = "og-tech-photo-busy";
const PHOTO_KIND = "og-tech-photo-kind";

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

// `kind` says which tile opened the camera ("job" | "proof"), so a shot that
// comes back after a WebView reload is offered to the right place.
export function markPhotoStart(path, kind = "job") {
  store()?.setItem(PHOTO_BUSY, "1");
  store()?.setItem(PHOTO_KIND, kind);
  pinRoute(path);
}

export function pendingPhotoKind() {
  return store()?.getItem(PHOTO_KIND) === "proof" ? "proof" : "job";
}

export function clearPhotoMark() {
  store()?.removeItem(PHOTO_BUSY);
  store()?.removeItem(PHOTO_KIND);
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

/** Re-apply saved draft fields after a WebView reload.
    Generic on purpose: for each draft key, call the matching `set<Key>` if the
    caller provided one, and silently skip the rest. Fields removed from the
    form (TDS, problems, …) then just stop restoring instead of crashing the
    screen when an old draft calls a setter that no longer exists. */
export function applyJobDraft(draft, setters) {
  if (!draft) return;
  for (const [k, v] of Object.entries(draft)) {
    if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    const fn = setters["set" + k[0].toUpperCase() + k.slice(1)];
    if (typeof fn === "function") fn(v);
  }
}
