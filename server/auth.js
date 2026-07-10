const jwt = require("jsonwebtoken");
const db = require("./db");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// 7 days (was 30d) — shortened as part of the pre-payments security pass:
// once Razorpay billing is live (Roadmap Phase 6), a leaked/stolen token
// staying valid for a month is a meaningfully worse exposure window than on
// a free study app. Revisit toward a short-lived-token + refresh-token model
// if 7 days ever proves annoying for regular users.
function signToken(userId) {
  return jwt.sign({ userId }, SECRET, { expiresIn: "7d" });
}

// Express middleware: requires a valid Bearer token, sets req.userId.
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
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
