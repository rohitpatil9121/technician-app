// Android can destroy the WebView while the camera is open. The getPhoto() promise
// in the job screen never resumes, so the shot used to be lost. Capacitor replays
// the pending result as "appRestoredResult" — but it can arrive before any screen
// has mounted, so this listener is registered at app start (imported by main.jsx)
// and simply holds the photo until the job screen collects it.
import { App as CapApp } from "@capacitor/app";

let pending = null;   // dataUrl waiting to be uploaded
let waiting = null;   // screen callback, if one is already listening

CapApp.addListener("appRestoredResult", (result) => {
  if (result?.pluginId !== "Camera" || result?.methodName !== "getPhoto") return;
  const dataUrl = result?.success ? result?.data?.dataUrl : null;
  if (!dataUrl) return;
  pending = dataUrl;
  if (waiting) { const cb = waiting; pending = null; cb(dataUrl); }
}).catch(() => {});

/** Photo restored before the screen mounted, if any. Returns it once. */
export function takePendingPhoto() {
  const p = pending;
  pending = null;
  return p;
}

/** Called when a photo is restored while the screen is open. Returns an unsubscribe. */
export function onPendingPhoto(cb) {
  waiting = cb;
  return () => { if (waiting === cb) waiting = null; };
}
