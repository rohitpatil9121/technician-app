/* Builds the real technician app into ONE html file that runs on sample data.

   For showing the app to a client: the file opens straight from disk or a
   WhatsApp attachment, needs no server and no login, and is the same screens
   the technicians use — only the backend is replaced by src/preview/mockApi.js.

     node scripts/build-demo-html.mjs [output.html]

   The demo entry and page are written for the build and removed afterwards, so
   nothing about the shipped app or the APK changes. */
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = resolve(process.argv[2] || join(root, "technician-app-demo.html"));
const entry = join(root, "src", "__demo_entry.jsx");
const page = join(root, "__demo.html");
const dist = mkdtempSync(join(tmpdir(), "og-demo-"));
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

writeFileSync(entry, `
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { JobsProvider } from "./store/JobsContext.jsx";
import "./lib/photoRestore.js";
import { forceLightTheme } from "./lib/theme.js";
import { initRipple } from "./lib/ripple.js";
import { installMockApi } from "./preview/mockApi.js";
import "./index.css";
forceLightTheme();
initRipple();
installMockApi();
localStorage.removeItem("tech_token");
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><HashRouter><JobsProvider><App /></JobsProvider></HashRouter></React.StrictMode>
);
`);
writeFileSync(page, `<!doctype html><html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0E6FC4" /><title>Technician App — sample</title></head>
<body><div id="root"></div><script type="module" src="/src/__demo_entry.jsx"></script></body></html>`);

try {
  await build({
    root, configFile: false, logLevel: "warn", base: "./",
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(version) },
    build: {
      outDir: dist, emptyOutDir: true, target: "es2020", cssMinify: true, cssCodeSplit: false,
      assetsInlineLimit: 100_000_000, modulePreload: false,
      rollupOptions: { input: page, output: { inlineDynamicImports: true } },
    },
  });
  let html = readFileSync(join(dist, "__demo.html"), "utf8");
  // Fold the one script and the one stylesheet into the page itself.
  html = html.replace(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) =>
    `<style>${readFileSync(join(dist, href), "utf8")}</style>`);
  html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) =>
    // A function, so "$&" inside the bundle is not read as a replacement pattern.
    `<script type="module">${readFileSync(join(dist, src), "utf8").replace(/<\/script/gi, "<\\/script")}</script>`);
  html = html.replace("DEMO DATA — no backend · ?demo=0 to exit", "SAMPLE DATA · login with any number and any 6-digit code");
  // The sample-data strip explains the login; past the login it only covers the tab bar.
  html = html.replace("</body>", `<script>setInterval(function(){var b=[].find.call(document.body.children,function(e){return (e.textContent||"").indexOf("SAMPLE DATA")===0});if(b)b.style.display=(location.hash===""||location.hash==="#/")?"":"none"},300)</script></body>`);
  if (/<script[^>]+src=|rel="stylesheet"/.test(html)) throw new Error("something was left outside the file");
  writeFileSync(out, html);
  console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
} finally {
  rmSync(entry, { force: true }); rmSync(page, { force: true }); rmSync(dist, { recursive: true, force: true });
}
