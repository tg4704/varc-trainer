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
const APP_VERSION = "streak-navguard-1";
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

// ── Fresh /api/dashboard handler defined HERE in index.js ─────────────────────
// The deployed routes/dashboard.js has been observed running stale code (its
// route was missing `authenticate`, so req.userId was undefined → query matched
// 0 rows → "0 attempts"). index.js deploys reliably, so we own the route here to
// guarantee correct, authenticated computation. Registered BEFORE the router
// mount below so it takes precedence for GET /api/dashboard.
{
  const db = require("./db");
  const { authenticate } = require("./auth");
  const questionsRepo = require("./questionsRepo");

  async function computeDashboard(userId) {
    const totals = await db.get(
      `SELECT COUNT(*) AS "totalAttempts",
              COALESCE(SUM(CASE WHEN a.skipped = 0 THEN 1 ELSE 0 END), 0) AS "answeredCount",
              COALESCE(SUM(a.is_correct), 0) AS "correctCount",
              COALESCE(SUM(a.selected_trap), 0) AS "trapCount",
              COALESCE(SUM(a.skipped), 0) AS "skippedCount",
              AVG(a.reasoning_score) AS "avgReasoningScore"
       FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1`, [userId]);

    const answered = Number(totals.answeredCount) || 0;
    const accuracy = answered ? Number(totals.correctCount) / answered : 0;
    const trapPickRate = answered ? Number(totals.trapCount) / answered : 0;

    const byType = {};
    for (const r of await db.all(
      `SELECT a.question_type AS type, COUNT(*) AS attempts,
              COALESCE(SUM(a.is_correct),0) AS correct,
              COALESCE(SUM(a.selected_trap),0) AS "trapPicked",
              AVG(a.reasoning_score) AS "avgReasoningScore"
       FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0 GROUP BY a.question_type`, [userId])) {
      byType[r.type] = { attempts: Number(r.attempts), correct: Number(r.correct),
        trapPicked: Number(r.trapPicked), avgReasoningScore: r.avgReasoningScore };
    }

    const byTopic = {};
    for (const r of await db.all(
      `SELECT a.topic, COUNT(*) AS attempts, COALESCE(SUM(a.is_correct),0) AS correct
       FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0 GROUP BY a.topic`, [userId])) {
      byTopic[r.topic] = { attempts: Number(r.attempts), correct: Number(r.correct) };
    }

    const byTrapType = {};
    for (const r of await db.all(
      `SELECT a.trap_type AS "trapType", COUNT(*) AS encountered,
              COALESCE(SUM(a.selected_trap),0) AS "fellFor"
       FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.skipped = 0 AND a.trap_type IS NOT NULL
       GROUP BY a.trap_type`, [userId])) {
      byTrapType[r.trapType] = { encountered: Number(r.encountered), fell_for: Number(r.fellFor) };
    }

    let weakestType = null, lowestAcc = Infinity;
    for (const [type, s] of Object.entries(byType)) {
      const acc = s.attempts ? s.correct / s.attempts : 1;
      if (acc < lowestAcc) { lowestAcc = acc; weakestType = type; }
    }
    let mostDangerousTrap = null, highestRate = -1;
    for (const [type, s] of Object.entries(byTrapType)) {
      const rate = s.encountered ? s.fell_for / s.encountered : 0;
      if (rate > highestRate) { highestRate = rate; mostDangerousTrap = type; }
    }

    const intuitionRow = await db.get(
      `SELECT COUNT(*) AS "totalIntuition", COALESCE(SUM(a.intuition_points),0) AS "totalPoints",
              AVG(a.time_taken_seconds) AS "avgTimeSecs"
       FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.mode = 'intuition'`, [userId]);
    const elimRows = await db.all(
      `SELECT a.eliminated_indices, a.correct_option_index
       FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 AND a.mode = 'intuition' AND a.eliminated_indices IS NOT NULL`, [userId]);
    let totalElim = 0, correctElim = 0;
    for (const row of elimRows) {
      try { for (const idx of JSON.parse(row.eliminated_indices)) { totalElim++; if (idx !== row.correct_option_index) correctElim++; } } catch {}
    }
    const intuitionStats = {
      totalAttempts: Number(intuitionRow.totalIntuition), totalPoints: Number(intuitionRow.totalPoints),
      avgTimeSecs: intuitionRow.avgTimeSecs, eliminationAccuracy: totalElim > 0 ? correctElim / totalElim : null,
    };

    const recentRows = await db.all(
      `SELECT a.* FROM attempts a JOIN sessions s ON a.session_id = s.id
       WHERE s.user_id = $1 ORDER BY a.id DESC LIMIT 10`, [userId]);
    const recentAttempts = await Promise.all(recentRows.map(async (a) => {
      const q = await questionsRepo.findById(a.question_id);
      return {
        questionId: a.question_id,
        questionSnippet: q ? q.question.split(/\s+/).slice(0, 8).join(" ") + "…" : a.question_id,
        question: q ? q.question : null, paragraph: q ? q.paragraph : null,
        options: q ? q.options.map((o) => ({ text: o.text })) : [],
        type: a.question_type, topic: a.topic,
        selectedOptionIndex: a.selected_option_index, correctOptionIndex: a.correct_option_index,
        trapOptionIndex: a.trap_option_index, isCorrect: a.is_correct === 1,
        selectedTrap: a.selected_trap === 1, skipped: a.skipped === 1, trapType: a.trap_type,
        reasoningText: a.reasoning_text,
        reasoningScore: a.reasoning_score, reasoningFeedback: a.reasoning_feedback,
        correctExplanation: a.correct_explanation, trapExplanation: a.trap_explanation,
        keyTakeaway: a.key_takeaway, timeTakenSeconds: a.time_taken_seconds,
        createdAt: a.created_at,
      };
    }));

    return {
      totalAttempts: Number(totals.totalAttempts), answeredCount: answered,
      correctCount: Number(totals.correctCount), skippedCount: Number(totals.skippedCount),
      accuracy, trapPickRate, avgReasoningScore: totals.avgReasoningScore,
      byType, byTopic, byTrapType, weakestType, mostDangerousTrap, recentAttempts, intuitionStats,
    };
  }

  app.get("/api/dashboard", authenticate, async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json(await computeDashboard(req.userId));
    } catch (e) { next(e); }
  });

  // Expose for the admin impersonation route to reuse (fresh, correct).
  app.locals.computeDashboard = computeDashboard;

  // Defined here for the same deploy-reliability reason as computeDashboard
  // above — routes/dashboard.js also has its own copies of these two, which
  // act as a fallback if this block is ever removed.
  const TREND_RANGE_DAYS = { "7d": 7, "30d": 30, all: 3650 };
  const TREND_MAX_POINTS = 60;

  app.get("/api/dashboard/trend", authenticate, async (req, res, next) => {
    try {
      const range = TREND_RANGE_DAYS[req.query.range] ? req.query.range : "30d";
      const days = TREND_RANGE_DAYS[range];
      const rows = await db.all(
        `SELECT DATE(a.created_at) AS day,
                COUNT(*) AS answered,
                COALESCE(SUM(a.is_correct), 0) AS correct
         FROM attempts a
         JOIN sessions s ON a.session_id = s.id
         WHERE s.user_id = $1 AND a.skipped = 0
           AND a.created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY DATE(a.created_at)
         ORDER BY day ASC`,
        [req.userId]
      );
      const trimmed = rows.slice(-TREND_MAX_POINTS);
      res.json({
        range,
        days: trimmed.map((r) => ({
          date: r.day,
          answered: Number(r.answered),
          accuracy: r.answered ? r.correct / r.answered : 0,
        })),
      });
    } catch (e) { next(e); }
  });

  app.get("/api/dashboard/heatmap", authenticate, async (req, res, next) => {
    try {
      // Combine Drills (attempts) + Coach (coach_attempts) activity, bucketed
      // by UTC date as a 'YYYY-MM-DD' STRING via to_char. Returning a real
      // date column makes pg hand back a JS Date whose String() form ("Tue
      // Jul 07…") never matches the client's ISO keys — the long-standing
      // reason the heatmap always read 0. ~6 months for the contribution graph.
      const rows = await db.all(
        `SELECT day, SUM(cnt) AS count FROM (
           SELECT to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
           FROM attempts a
           JOIN sessions s ON a.session_id = s.id
           WHERE s.user_id = $1 AND a.skipped = 0
             AND a.created_at >= NOW() - INTERVAL '183 days'
           GROUP BY 1
           UNION ALL
           SELECT to_char(ca.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
           FROM coach_attempts ca
           JOIN coach_sessions cs ON ca.coach_session_id = cs.id
           WHERE cs.user_id = $1
             AND ca.created_at >= NOW() - INTERVAL '183 days'
           GROUP BY 1
         ) t
         GROUP BY day`,
        [req.userId]
      );
      const byDate = {};
      rows.forEach((r) => { byDate[r.day] = Number(r.count); });
      const out = [];
      for (let i = 182; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const iso = d.toISOString().slice(0, 10);
        out.push({ date: iso, count: byDate[iso] || 0 });
      }
      res.json({ days: out });
    } catch (e) { next(e); }
  });
}

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
    // Unknown API paths and static-asset requests must NOT fall through to
    // index.html — returning HTML for a missing /api/* or /assets/*.js makes
    // clients parse HTML as JSON/JS (cryptic crashes). Return a real 404.
    if (req.path.startsWith("/api/") || req.path.startsWith("/assets/") || path.extname(req.path)) {
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
