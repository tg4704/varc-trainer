// Phase 9: write one row to api_calls per AI call. Safe to call inside the
// evaluate route — failures here are swallowed (logging shouldn't break user
// flow).
const db = require("../db");
const { estimateCost } = require("./pricing");

async function logApiCall({
  userId = null,
  route,
  provider,
  model,
  inputTokens = 0,
  outputTokens = 0,
  status = "ok",
  errorMessage = null,
}) {
  try {
    const cost = estimateCost(model, inputTokens, outputTokens);
    await db.run(
      `INSERT INTO api_calls
         (user_id, route, provider, model, input_tokens, output_tokens, est_cost_usd, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      // Truncated defensively — some provider errors embed the full request
      // body; we only need enough to diagnose, not a blob to store forever.
      [userId, route, provider, model, inputTokens, outputTokens, cost, status, errorMessage ? String(errorMessage).slice(0, 2000) : null]
    );
  } catch (e) {
    console.warn("[apiLog] failed to log api call:", e.message);
  }
}

module.exports = { logApiCall };
