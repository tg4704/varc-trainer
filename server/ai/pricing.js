// Phase 9: per-model pricing for cost estimation. USD per token.
// Update when models change or new providers are added.
// Sources: anthropic.com/pricing, openai.com/pricing, ai.google.dev/pricing.
const PRICES = {
  // Anthropic
  "claude-haiku-4-5":  { input: 1.00 / 1e6, output: 5.00 / 1e6 },
  "claude-sonnet-4-5": { input: 3.00 / 1e6, output: 15.00 / 1e6 },
  "claude-opus-4-1":   { input: 15.00 / 1e6, output: 75.00 / 1e6 },
  // OpenAI (Phase 14 / Coach free tier)
  "gpt-4o-mini":       { input: 0.15 / 1e6, output: 0.60 / 1e6 },
  // Google Gemini (Phase 14 / Coach free tier alt)
  "gemini-2.5-flash":  { input: 0.30 / 1e6, output: 2.50 / 1e6 },
};

// Returns USD cost for a given (model, input_tokens, output_tokens) triple.
// Unknown models cost 0 — admin sees them in the log but they don't inflate totals.
function estimateCost(model, inputTokens, outputTokens) {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens || 0) * p.input + (outputTokens || 0) * p.output;
}

module.exports = { PRICES, estimateCost };
