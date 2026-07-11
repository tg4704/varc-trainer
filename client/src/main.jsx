import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { ThemeProvider } from "./theme.jsx";
import { initSentry } from "./sentry.js";
import { initAnalytics } from "./analytics.js";
import "./index.css";

initSentry();
initAnalytics(); // no-op unless the user already granted consent in a prior session

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
