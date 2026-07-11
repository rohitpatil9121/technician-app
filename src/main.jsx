import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import { JobsProvider } from "./store/JobsContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <JobsProvider>
        <App />
      </JobsProvider>
    </HashRouter>
  </React.StrictMode>
);
