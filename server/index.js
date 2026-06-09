require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");

// ── Sentry (error monitoring) — init before anything else ────────────────────
// @sentry/node v8: just call init() — no manual middleware needed.
if (process.env.SENTRY_DSN) {
  try {
    require("@sentry/node").init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "production",
      tracesSampleRate: 0.1,
    });
  } catch {
    console.warn("Sentry init failed — continuing without it");
  }
}

const app = express();

app.use(cors());
app.use(express.json());

// ── Request logger ────────────────────────────────────────────────────────────
// Logs every API request with method, path, status, and duration.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    // Skip static asset noise — only log API routes
    if (!req.path.startsWith("/api")) return;
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level](`${req.method} ${req.path} ${res.statusCode}`, { ms, status: res.statusCode });
  });
  next();
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/sessions", require("./routes/sessions"));
app.use("/api/questions", require("./routes/questions"));
app.use("/api/attempts", require("./routes/attempts"));
app.use("/api/attempts", require("./routes/evaluate"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/account", require("./routes/account"));
app.use("/api/my-questions", require("./routes/myQuestions"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/coach", require("./routes/coach"));
app.use("/api/sr", require("./routes/sr"));
app.use("/api/streak", require("./routes/streak"));

// ── Serve React build in production ──────────────────────────────────────────
// When Railway runs `npm run build` for the client, the output lands at client/dist/.
// Express then serves it statically and catches SPA deep links with the wildcard.
const distPath = path.join(__dirname, "../client/dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA catch-all: any non-API GET returns index.html so React Router handles it
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Global async error handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`VARC Trainer server started`, { port: PORT, env: process.env.NODE_ENV || "development" });
});
