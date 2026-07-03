// Helpers for the Call + Maps buttons. Both open native handlers on a phone:
// tel: launches the dialer, the maps URL opens Google Maps (or the OS map app).

// Dial a phone number. Strips spaces/dashes so tel: gets a clean target.
export function callPhone(phone) {
  const p = String(phone || "").replace(/[\s()-]/g, "");
  if (!p) return;
  window.location.href = `tel:${p}`;
}

// Open the address in Google Maps. On phones this deep-links into the Maps app;
// on desktop it opens maps in a new tab.
export function openMaps(address) {
  const a = String(address || "").trim();
  if (!a) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
  window.open(url, "_blank", "noopener");
}
