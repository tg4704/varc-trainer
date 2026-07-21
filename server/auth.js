const jwt = require("jsonwebtoken");
const db = require("./db");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// 7 days (was 30d) - shortened as part of the pre-payments security pass:
// once Razorpay billing is live (Roadmap Phase 6), a leaked/stolen token
// staying valid for a month is a meaningfully worse exposure window than on
// a free study app. Revisit toward a short-lived-token + refresh-token model
// if 7 days ever proves annoying for regular users.
function signToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: "7d" });
}

// Express middleware: requires a valid Bearer token, sets req.userId.
//
// The user-existence check is deliberate: a JWT is stateless, so before this
// existed, a token held at the moment an account was deleted kept working
// until its natural 7-day expiry (reads returned empty data, writes failed on
// a foreign-key violation). That's the "deleted user's token still works"
// case. Costs one indexed primary-key lookup per authenticated request, which
// is negligible at current scale.
//
// NOTE: this is existence-only, NOT true revocation — it can't invalidate a
// token for an account that still exists (e.g. "log out everywhere" after a
// credential leak). That needs a jti-based revocation list; see the P1-7 entry
// in FAILURE_REPORT.md. Revisit alongside the refresh-token work.
async function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const exists = await db.get("SELECT 1 AS ok FROM users WHERE id = $1", [payload.userId]);
    // Same generic message as a bad/expired token — a deleted account
    // shouldn't be distinguishable from an invalid signature.
    if (!exists) return res.status(401).json({ error: "Invalid or expired session" });
  } catch (e) {
    // A DB hiccup must not be silently treated as "valid token" — surface it.
    return next(e);
  }

  req.userId = payload.userId;
  next();
}

// Express middleware: must come AFTER authenticate(). Requires role='admin'.
// Sets req.user with the full user row.
async function requireAdmin(req, res, next) {
  try {
    const user = await db.get(
      "SELECT id, username, email, role FROM users WHERE id = $1",
      [req.userId]
    );
    if (!user) return res.status(401).json({ error: "Invalid session" });
    if (user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { signToken, authenticate, requireAdmin, SECRET };
