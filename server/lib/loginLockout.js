// Account lockout - 5 failed attempts / 15 min, keyed by identifier+IP (not
// identifier alone) so a distributed credential-stuffing attempt against one
// account from many IPs doesn't get to hide behind a single shared lock, and
// so someone can't lock a victim out just by deliberately failing their
// login from one IP (per-IP-and-identifier scoping limits that abuse).
// In-memory - matches rateLimiters.js's note: fine for one Railway instance,
// move to Redis (Upstash) if the app ever runs on more than one.
//
// The lockout is reported with the SAME generic "Invalid credentials"
// message the login route already uses for a wrong password - never reveal
// that an account is specifically locked, which would itself leak that the
// account exists and is under attack.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map(); // key -> { count, firstFailAt }

function keyFor(identifier, ip) {
  return `${String(identifier || "").trim().toLowerCase()}::${ip}`;
}

function isLocked(identifier, ip) {
  const entry = failures.get(keyFor(identifier, ip));
  if (!entry) return false;
  if (Date.now() - entry.firstFailAt > WINDOW_MS) {
    failures.delete(keyFor(identifier, ip));
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(identifier, ip) {
  const key = keyFor(identifier, ip);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.firstFailAt > WINDOW_MS) {
    failures.set(key, { count: 1, firstFailAt: Date.now() });
  } else {
    entry.count++;
  }
}

function clearFailures(identifier, ip) {
  failures.delete(keyFor(identifier, ip));
}

// Sweep expired entries periodically so the Map doesn't grow unbounded on a
// long-running process - attempts stop mattering after WINDOW_MS anyway.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of failures) {
    if (now - entry.firstFailAt > WINDOW_MS) failures.delete(key);
  }
}, WINDOW_MS).unref();

module.exports = { isLocked, recordFailure, clearFailures };
