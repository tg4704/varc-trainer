// Phase 9: per-model pricing for cost estimation. USD per token.
// All AI calls now go through OpenRouter. Model IDs use OpenRouter's format: "provider/model-name".
// Update prices from https://openrouter.ai/models or the provider's own pricing page.
const PRICES = {
  // Anthropic via OpenRouter
  "anthropic/claude-haiku-4-5":  { input: 1.00 / 1e6, output: 5.00 / 1e6 },
  "anthropic/claude-3-5-haiku":  { input: 0.80 / 1e6, output: 4.00 / 1e6 },
  "anthropic/claude-sonnet-4-5": { input: 3.00 / 1e6, output: 15.00 / 1e6 },
  "anthropic/claude-opus-4-1":   { input: 15.00 / 1e6, output: 75.00 / 1e6 },
  // OpenAI via OpenRouter
  "openai/gpt-4o-mini":          { input: 0.15 / 1e6, output: 0.60 / 1e6 },
  "openai/gpt-4o":               { input: 5.00 / 1e6, output: 15.00 / 1e6 },
  // Google via OpenRouter
  "google/gemini-flash-1.5":     { input: 0.075 / 1e6, output: 0.30 / 1e6 },
  "google/gemini-2.5-flash":     { input: 0.15 / 1e6, output: 0.60 / 1e6 },
  // Meta via OpenRouter (free tier options)
  "meta-llama/llama-3.1-8b-instruct": { input: 0.05 / 1e6, output: 0.05 / 1e6 },
};

// Returns USD cost for a given (model, input_tokens, output_tokens) triple.
// Unknown models cost 0 — admin sees them in the log but they don't inflate totals.
function estimateCost(model, inputTokens, outputTokens) {
  const p = PRICES[model];
  if (!p) return 0;
  return (inputTokens || 0) * p.input + (outputTokens || 0) * p.output;
}

module.exports = { PRICES, estimateCost };
