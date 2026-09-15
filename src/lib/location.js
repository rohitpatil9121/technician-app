// Live location tracking (Android native only). While the technician is logged
// in, stream the device GPS to the backend so the manager dashboard shows their
// position. No-op on web/dev. Throttled so we don't spam the API.
//
// BACKGROUND ON, with the notification that Android demands (owner, 17 Aug 2026).
//
// The history matters, because this was switched off once already. Android will
// only keep feeding location to a backgrounded app from a foreground service,
// and a foreground service must post a permanent notification — the plugin's own
// README says so, and there is no supported way around it. The notification was
// removed to stop technicians seeing "location sharing on" all day; background
// updates went with it, and the dashboard quietly became a record of wherever
// each phone was last unlocked.
//
// The trade was re-made deliberately: the office needs to know where its
// technicians are, and the price of that is a line in the notification shade.
// So the wording is ours rather than the plugin's default "Using your location"
// — it says who is tracking and why, which is the least a technician is owed.
//
import { Capacitor, registerPlugin } from "@capacitor/core";
import { api } from "./api.js";

const BackgroundGeolocation = registerPlugin("BackgroundGeolocation");

let watcherId = null;
let lastSent = 0;
const MIN_INTERVAL = 30000;

export async function startLocationTracking() {
  if (!Capacitor.isNativePlatform() || watcherId) return;
  try {
    watcherId = await BackgroundGeolocation.addWatcher(
      {
        /* These two are what start the foreground service, and so what make
           background updates possible at all. Naming the company and the reason
           beats the plugin's default "Using your location", which reads like
           something is spying. */
        backgroundTitle: "Oasis Technician — on duty",
        backgroundMessage: "Sharing your location with the office while you are signed in.",
        requestPermissions: true,
        stale: false,
        // Metres of movement before a new reading — keeps the stream quiet
        // while the technician is parked at a job, and the battery with it.
        distanceFilter: 25,
      },
      (position, error) => {
        if (error || !position) return; // e.g. permission denied — dashboard just shows last known
        const now = Date.now();
        if (now - lastSent < MIN_INTERVAL) return;
        lastSent = now;
        api.saveLocation(position.latitude, position.longitude).catch(() => {});
      }
    );
  } catch { /* location unavailable — ignore */ }
}

export async function stopLocationTracking() {
  if (!watcherId) return;
  try { await BackgroundGeolocation.removeWatcher({ id: watcherId }); } catch { /* ignore */ }
  watcherId = null;
}

/* Where the technician was standing when he wrote the bill.

   The office asked for this so a bill can be placed: the job says Wakad, the
   bill was written in Wakad. It is read ONCE, at the moment the bill is saved,
   and travels with that step — not from the live stream above, which is stale
   the moment the app is backgrounded and off entirely on a phone that denied
   the permission.

   A one-shot read needs no foreground service and no permanent notification,
   because the app is open in his hand when he writes the bill. That is the whole
   reason this is separate from the tracker: the tracker's cost (a notification
   all day) buys nothing here.

   Never throws and never blocks: a bill must be saveable in a basement with no
   GPS fix. It resolves to null and the bill saves without a location. */
const FIX_TIMEOUT_MS = 8000;

export function getPositionOnce() {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let id = null, done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (id) BackgroundGeolocation.removeWatcher({ id }).catch(() => {});
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), FIX_TIMEOUT_MS);

    BackgroundGeolocation.addWatcher(
      { requestPermissions: true, stale: true, distanceFilter: 0 },
      (position, error) => {
        clearTimeout(timer);
        if (error || !position) return finish(null);
        finish({
          lat: position.latitude,
          lng: position.longitude,
          accuracy: position.accuracy ?? null,
          at: new Date().toISOString(),
        });
      }
    ).then((watcherId) => {
      id = watcherId;
      if (done) BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => {});
    }).catch(() => finish(null));
  });
}
