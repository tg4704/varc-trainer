// Structured logger — writes to console always, and to BetterStack Logtail
// when BETTERSTACK_SOURCE_TOKEN is set (production).
// Usage: const logger = require("./logger"); logger.info("msg", { ctx });
// Return null (not false) when there's no Logtail, so callers' `getLogtail()?.`
// optional chaining short-circuits. `false?.info()` does NOT short-circuit — it
// throws "info is not a function", which crashed startup on every run without a
// token (i.e. local dev).
let _logtail = null;
let _checked = false;

function getLogtail() {
  if (_checked) return _logtail;
  _checked = true;
  if (!process.env.BETTERSTACK_SOURCE_TOKEN) {
    _logtail = null;
    return null;
  }
  try {
    const { Logtail } = require("@logtail/node");
    _logtail = new Logtail(process.env.BETTERSTACK_SOURCE_TOKEN);
  } catch {
    _logtail = null;
  }
  return _logtail;
}

const logger = {
  info(msg, ctx = {}) {
    console.log(`[INFO] ${msg}`, Object.keys(ctx).length ? ctx : "");
    getLogtail()?.info(msg, ctx);
  },
  warn(msg, ctx = {}) {
    console.warn(`[WARN] ${msg}`, Object.keys(ctx).length ? ctx : "");
    getLogtail()?.warn(msg, ctx);
  },
  error(msg, ctx = {}) {
    console.error(`[ERROR] ${msg}`, Object.keys(ctx).length ? ctx : "");
    getLogtail()?.error(msg, ctx);
  },
};

module.exports = logger;
