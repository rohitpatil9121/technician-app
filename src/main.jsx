import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { JobsProvider } from "./store/JobsContext.jsx";
// Registers the camera-restore listener before anything renders — the result can
// arrive before the job screen mounts.
import "./lib/photoRestore.js";
import { forceLightTheme } from "./lib/theme.js";
import { initRipple } from "./lib/ripple.js";
import "./index.css";

// Browser demo: #/demo swaps the backend for an in-memory stub so the whole app
// is walkable without a server or a login. Must run before React mounts —
// JobsProvider reads the token during its very first render. Ships as dead code
// in production (the hash never matches); delete src/preview/ to remove it.
// Dark mode was removed — undo it for anyone left on it from an earlier build.
forceLightTheme();
initRipple();

const mount = () =>
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <HashRouter>
        <JobsProvider>
          <App />
        </JobsProvider>
      </HashRouter>
    </React.StrictMode>
  );

/* Demo mode has to be sticky: HashRouter rewrites #/demo to #/ on the first
   render (there is no /demo route), so the hash alone would survive exactly one
   paint. The flag persists until ?demo=0 clears it.

   The whole block is behind import.meta.env.DEV so Rollup drops it from
   production bundles — the stub returns a valid token for any OTP, which has no
   business being inside a shipped APK even if it is unreachable there. */
const DEMO_KEY = "og-demo-mode";
let wantsDemo = false;

if (import.meta.env.DEV && typeof location !== "undefined") {
  if (location.search.includes("demo=0")) localStorage.removeItem(DEMO_KEY);
  else if (location.hash.startsWith("#/demo") || location.search.includes("demo=1")) {
    localStorage.setItem(DEMO_KEY, "1");
  }
  wantsDemo = localStorage.getItem(DEMO_KEY) === "1";
}

if (wantsDemo) {
  import("./preview/mockApi.js").then(({ installMockApi }) => {
    installMockApi();
    localStorage.removeItem("tech_token"); // always start the demo at Login
    mount();
  });
} else {
  mount();
}
