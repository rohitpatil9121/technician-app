// Live location tracking (Android native only). While the technician is logged
// in, stream the device GPS to the backend so the manager dashboard shows their
// position. No-op on web/dev. Throttled so we don't spam the API.
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { api } from "./api.js";

let watchId = null;
let lastSent = 0;
const MIN_INTERVAL = 30000;

export async function startLocationTracking() {
  if (!Capacitor.isNativePlatform() || watchId) return;
  try {
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      perm = await Geolocation.requestPermissions();
    }
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") return;

    watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: false, timeout: 25000, maximumAge: 15000 },
      (pos) => {
        if (!pos?.coords) return;
        const now = Date.now();
        if (now - lastSent < MIN_INTERVAL) return;
        lastSent = now;
        api.saveLocation(pos.coords.latitude, pos.coords.longitude).catch(() => {});
      }
    );
  } catch { /* location unavailable — ignore */ }
}

export async function stopLocationTracking() {
  if (!watchId) return;
  try { await Geolocation.clearWatch({ id: watchId }); } catch { /* ignore */ }
  watchId = null;
}
