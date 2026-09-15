/* The dark-mode toggle was removed from the header. Anyone who switched to dark
   on an earlier build still has "dark" in localStorage and no way to switch
   back, so clear it and force light on every boot. The .dark token block stays
   in index.css — nothing sets the class any more, and keeping it means dark can
   be re-enabled later without redoing the colour work. */

const KEY = "og-theme";

export function forceLightTheme() {
  document.documentElement.classList.remove("dark");
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", "#0E6FC4");
}
