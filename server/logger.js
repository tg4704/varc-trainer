// Structured logger — writes to console always, and to BetterStack Logtail
// when BETTERSTACK_SOURCE_TOKEN is set (production).
// Usage: const logger = require("./logger"); logger.info("msg", { ctx });
let _logtail = null;

function getLogtail() {
  if (_logtail !== null) return _logtail;
  if (!process.env.BETTERSTACK_SOURCE_TOKEN) {
    _logtail = false; // mark as checked — no token
    return false;
  }
  try {
    const { Logtail } = require("@logtail/node");
    _logtail = new Logtail(process.env.BETTERSTACK_SOURCE_TOKEN);
  } catch {
    _logtail = false;
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
