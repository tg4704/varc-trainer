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

// Build/version marker so we can confirm exactly which backend code is live
// (Railway "Redeploy" can rebuild a stale deployment instead of the latest
// commit; this header makes the running version externally verifiable).
const APP_VERSION = "dash-nocache-1";
app.use((req, res, next) => {
  res.setHeader("X-App-Version", APP_VERSION);
  next();
});

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
  // Hashed assets are immutable — cache them hard. index.html must NOT be
  // cached so a new deploy is picked up immediately (prevents stale bundles
  // that reference chunk hashes the server no longer has).
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // SPA catch-all: any non-API GET returns index.html so React Router handles it.
  // IMPORTANT: never fall through to index.html for static-asset requests
  // (e.g. a stale client requesting a deleted /assets/*.js chunk). Returning
  // HTML for a missing .js makes the browser execute HTML as JS → cryptic
  // "n is not a function" crashes. Return 404 so React.lazy throws a proper
  // ChunkLoadError instead.
  app.get("*", (req, res) => {
    if (req.path.startsWith("/assets/") || path.extname(req.path)) {
      return res.status(404).json({ error: "Not found" });
    }
    res.setHeader("Cache-Control", "no-cache");
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
