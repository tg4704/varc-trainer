// Unified AI provider using OpenRouter (OpenAI-compatible API).
// All AI calls go through callModel() — never import Anthropic/OpenAI SDKs directly in routes.
// Model and key are env-var driven so they can be swapped without code changes.
const OpenAI = require("openai");

let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        // OpenRouter uses these for their dashboard / rate-limit tiers
        "HTTP-Referer": process.env.APP_URL || "https://varc-trainer.up.railway.app",
        "X-Title": "VARC Trainer",
      },
    });
  }
  return _client;
}

// Default model — override with AI_MODEL env var.
// Check openrouter.ai/models for available model IDs.
const DEFAULT_MODEL = process.env.AI_MODEL || "anthropic/claude-haiku-4-5";

/**
 * callModel({ model?, system?, messages, maxTokens? })
 *
 * messages: array of { role: "user" | "assistant", content: string }
 * Returns: { text: string, usage: { input_tokens: number, output_tokens: number } }
 */
async function callModel({ model = DEFAULT_MODEL, system, messages, maxTokens = 1024 }) {
  const msgs = [];
  if (system) msgs.push({ role: "system", content: system });
  msgs.push(...messages);

  const response = await getClient().chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: msgs,
  });

  return {
    text: response.choices[0].message.content,
    usage: {
      input_tokens: response.usage?.prompt_tokens || 0,
      output_tokens: response.usage?.completion_tokens || 0,
    },
  };
}

// OpenRouter often nests the actually-useful diagnostic (e.g. "model X is
// temporarily rate-limited upstream, add your own key to accumulate your
// rate limits") under error.metadata.raw — the openai SDK's err.message
// only surfaces the generic "429 Provider returned error" wrapper. Routes
// use this instead of err.message when logging to api_calls so the admin
// Logs page shows the actionable detail, not just the HTTP status wrapper.
function describeError(err) {
  const base = err?.message || String(err);
  const raw = err?.error?.metadata?.raw;
  return raw && raw !== base ? `${base}: ${raw}` : base;
}

module.exports = { callModel, DEFAULT_MODEL, describeError };
