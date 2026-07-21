// Unified AI provider using OpenRouter (OpenAI-compatible API).
// All AI calls go through callModel() - never import Anthropic/OpenAI SDKs directly in routes.
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
      // Without this the SDK's own default (~10 min) is the only backstop -
      // if OpenRouter or the upstream model hangs rather than errors, every
      // route calling callModel() shows "Analyzing…"/"Generating…" with no
      // way to know it's dead. 30s is generous for these short evaluation/
      // generation calls; a genuine timeout throws APIConnectionTimeoutError,
      // which every calling route already catches the same way as any other
      // AI failure (logs to api_calls, returns aiError: true to the client).
      timeout: 30_000,
      defaultHeaders: {
        // OpenRouter uses these for their dashboard / rate-limit tiers
        "HTTP-Referer": process.env.APP_URL || "https://varc-trainer.up.railway.app",
        "X-Title": "VARC Trainer",
      },
    });
  }
  return _client;
}

// Default model - override with AI_MODEL env var.
// Check openrouter.ai/models for available model IDs.
const DEFAULT_MODEL = process.env.AI_MODEL || "anthropic/claude-haiku-4.5";

const { getTier, SAFE_MODEL, ENABLE_TIERS } = require("../config/tiers");

// The ordered model chain to try for a given tier + call type. When tiers are
// off (or no tier resolved), this is just [DEFAULT_MODEL] - identical to the
// pre-monetization behavior. When on: [tier primary, tier fallback, SAFE_MODEL].
function resolveModels(tierKey, callType) {
  if (!ENABLE_TIERS || !tierKey) return [DEFAULT_MODEL];
  const tier = getTier(tierKey);
  const chain = [tier.models?.[callType], tier.fallbackModels?.[callType], SAFE_MODEL];
  return [...new Set(chain.filter(Boolean))];
}

// Whether an error is worth retrying on the next model in the chain (transient/
// provider-specific) vs a genuine client error that'd fail identically everywhere.
function isRetryable(err) {
  const status = err?.status;
  if (status && status >= 400 && status < 500 && status !== 429) return false;
  return true; // 429, 5xx, timeouts, connection errors
}

// Some models are *reasoning-mandatory* (e.g. openai/gpt-oss-120b) and reject
// any attempt to turn thinking off with a 400 like "Reasoning is mandatory for
// this endpoint and cannot be disabled." Detect that specific case so we can
// retry the SAME model with minimal reasoning instead of failing the call.
function isReasoningMandatory(err) {
  if (err?.status !== 400) return false;
  const txt = `${err?.message || ""} ${err?.error?.metadata?.raw || ""}`.toLowerCase();
  return /reasoning/.test(txt) && /(mandatory|cannot be disabled|can't be disabled|required|must)/.test(txt);
}

// One completion attempt against a single model. Tries with thinking OFF first;
// if the model mandates reasoning, retries once with minimal effort so the call
// still succeeds (and burns as few reasoning tokens as the model allows).
async function createCompletion(model, msgs, maxTokens) {
  const base = { model, max_tokens: maxTokens, messages: msgs };
  try {
    // Force thinking/reasoning OFF. The task (grade a paragraph → small JSON)
    // needs no chain-of-thought, and "thinking" models bill their hidden
    // reasoning tokens as output - a cost trap (see tiers.js notes). OpenRouter's
    // unified `reasoning` param maps this to each provider's own disable switch
    // (GLM-4.6, DeepSeek V3.1, Claude honor it); non-reasoning models ignore it.
    return await getClient().chat.completions.create({ ...base, reasoning: { enabled: false } });
  } catch (err) {
    if (!isReasoningMandatory(err)) throw err;
    // Model won't let reasoning be disabled - ask for the least it allows.
    console.warn(`[ai] ${model} mandates reasoning; retrying with effort=low`);
    return getClient().chat.completions.create({ ...base, reasoning: { effort: "low" } });
  }
}

/**
 * callModel({ model?, models?, system?, messages, maxTokens? })
 *
 * Pass a single `model`, or `models` as an ordered fallback chain (from
 * resolveModels). messages: array of { role, content }.
 * Returns: { text, usage: { input_tokens, output_tokens }, model } - `model`
 * is the one that actually answered, so the caller logs the real cost.
 */
async function callModel({ model, models, system, messages, maxTokens = 1024 }) {
  const chain = models && models.length ? models : [model || DEFAULT_MODEL];
  const msgs = [];
  if (system) msgs.push({ role: "system", content: system });
  msgs.push(...messages);

  let lastErr;
  for (let i = 0; i < chain.length; i++) {
    try {
      const response = await createCompletion(chain[i], msgs, maxTokens);
      return {
        text: response.choices[0].message.content,
        usage: {
          input_tokens: response.usage?.prompt_tokens || 0,
          output_tokens: response.usage?.completion_tokens || 0,
        },
        model: chain[i],
      };
    } catch (err) {
      lastErr = err;
      // Only fall through to the next model on a transient/provider error, and
      // only if there is a next model to try.
      if (i < chain.length - 1 && isRetryable(err)) {
        console.warn(`[ai] ${chain[i]} failed (${err?.status || "?"}), trying ${chain[i + 1]}`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// OpenRouter often nests the actually-useful diagnostic (e.g. "model X is
// temporarily rate-limited upstream, add your own key to accumulate your
// rate limits") under error.metadata.raw - the openai SDK's err.message
// only surfaces the generic "429 Provider returned error" wrapper. Routes
// use this instead of err.message when logging to api_calls so the admin
// Logs page shows the actionable detail, not just the HTTP status wrapper.
function describeError(err) {
  const base = err?.message || String(err);
  const raw = err?.error?.metadata?.raw;
  return raw && raw !== base ? `${base}: ${raw}` : base;
}

module.exports = { callModel, resolveModels, DEFAULT_MODEL, describeError };
