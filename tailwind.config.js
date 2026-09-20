import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Resolve content globs against THIS file's folder, not the process cwd — so the
// build works whether Vite is launched from here or from a parent/monorepo root.
const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [join(here, "index.html"), join(here, "src/**/*.{js,jsx}")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Material 3: Roboto first (native on Android, so no webfont ships).
        sans: ["Roboto", "Roboto Flex", "system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      colors: {
        // Semantic surface/text tokens — values are RGB triplets in index.css,
        // set to the Material 3 palette from the client-approved mockup.
        surface: "rgb(var(--surface) / <alpha-value>)",
        sunken: "rgb(var(--sunken) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        body: "rgb(var(--text-body) / <alpha-value>)",
        strong: "rgb(var(--text-strong) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        subtle: "rgb(var(--text-subtle) / <alpha-value>)",
        // M3 tonal roles (mockup values, verbatim). `tint` = the -container
        // colour text/icons sit on; `fg` = the role used as readable text.
        brand: {
          DEFAULT: "#0B57D0",
          dark: "#0842A0",
          light: "#2E93E6", // avatar gradient top from the mockup
          tint: "#D3E3FD",
          50: "#D3E3FD", // legacy alias — same as tint
          100: "#D3E3FD",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
        },
        ok: { DEFAULT: "#146C2E", light: "#C4EED0", tint: "#C4EED0", fg: "rgb(var(--ok-fg) / <alpha-value>)" },
        warn: { DEFAULT: "#E8710A", light: "#FFE2BE", tint: "#FFE2BE", fg: "rgb(var(--warn-fg) / <alpha-value>)" },
        danger: { DEFAULT: "#B3261E", light: "#F9DEDC", tint: "#F9DEDC", fg: "rgb(var(--danger-fg) / <alpha-value>)" },
        accent: { DEFAULT: "#6750A4", tint: "#EADDFF" }, // M3 purple ("Added by you")
        wa: { DEFAULT: "#1FA855", dark: "#0B5B33", tint: "#DCF7E6" }, // WhatsApp green
        tonal: "#ECE6F0", // surface-container-high: nav bar, seg track, fields
        hair: "#CAC4D0",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        pop: "0 10px 30px -10px rgb(15 23 42 / 0.25)",
      },
    },
  },
  plugins: [],
};
