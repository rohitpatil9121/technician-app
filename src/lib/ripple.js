/* Material 3 touch ripple, delegated once at boot. Any element with .m3r (or a
   button inside the app shell) gets a ripple from the touch point. Transform +
   opacity only, and .ripple is display:none under prefers-reduced-motion. */
export function initRipple() {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target.closest("button, .m3r");
      if (!t || t.disabled) return;
      const cs = getComputedStyle(t);
      if (cs.position === "static") t.style.position = "relative";
      if (cs.overflow !== "hidden") t.style.overflow = "hidden";
      const r = t.getBoundingClientRect();
      const d = Math.max(r.width, r.height);
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.width = s.style.height = d + "px";
      s.style.left = e.clientX - r.left - d / 2 + "px";
      s.style.top = e.clientY - r.top - d / 2 + "px";
      t.appendChild(s);
      setTimeout(() => s.remove(), 520);
    },
    true
  );
}
