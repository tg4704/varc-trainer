const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const crypto  = require("crypto");
const db      = require("../db");
const { signToken, authenticate } = require("../auth");
const { sendOtpEmail } = require("../email");

// ── Helpers ───────────────────────────────────────────────────────────────────

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role || "user",
    createdAt: u.created_at,
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// Create a new OTP record; invalidates any previous unused OTPs for same user+purpose.
async function createOtp(userId, purpose) {
  const otp       = generateOtp();
  const hash      = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db.run(
    "UPDATE otp_tokens SET used = 1 WHERE user_id = $1 AND purpose = $2 AND used = 0",
    [userId, purpose]
  );
  await db.run(
    "INSERT INTO otp_tokens (user_id, token_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)",
    [userId, hash, purpose, expiresAt]
  );
  return otp;
}

// Verify an OTP. Returns { ok, error }.
async function verifyOtp(userId, otp, purpose) {
  const hash  = hashOtp(otp);
  const token = await db.get(
    "SELECT * FROM otp_tokens WHERE user_id = $1 AND purpose = $2 AND used = 0 ORDER BY id DESC LIMIT 1",
    [userId, purpose]
  );

  if (!token) return { ok: false, error: "No active code found. Please request a new one." };
  if (new Date(token.expires_at) < new Date()) {
    await db.run("UPDATE otp_tokens SET used = 1 WHERE id = $1", [token.id]);
    return { ok: false, error: "Code has expired. Please request a new one." };
  }
  if (token.attempts >= 5) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }
  if (token.token_hash !== hash) {
    await db.run("UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = $1", [token.id]);
    const left = 5 - (token.attempts + 1);
    return { ok: false, error: `Incorrect code. ${left} attempt${left !== 1 ? "s" : ""} remaining.` };
  }

  // Valid — mark used
  await db.run("UPDATE otp_tokens SET used = 1 WHERE id = $1", [token.id]);
  return { ok: true };
}

// Rate-limit: one OTP per 60 seconds per user+purpose
async function canResend(userId, purpose) {
  const last = await db.get(
    "SELECT created_at FROM otp_tokens WHERE user_id = $1 AND purpose = $2 ORDER BY id DESC LIMIT 1",
    [userId, purpose]
  );
  if (!last) return { allowed: true };
  const age = (Date.now() - new Date(last.created_at).getTime()) / 1000;
  if (age < 60) return { allowed: false, wait: Math.ceil(60 - age) };
  return { allowed: true };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password)
    return res.status(400).json({ error: "Username, email, and password are required" });
  if (username.length < 3)
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ error: "Please enter a valid email address" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });

  const existing = await db.get(
    "SELECT id, username, email FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );
  if (existing) {
    const field = existing.email === email ? "email" : "username";
    return res.status(409).json({ error: `That ${field} is already registered` });
  }

  const hash   = bcrypt.hashSync(password, 10);
  const result = await db.run(
    "INSERT INTO users (username, email, password_hash, email_verified) VALUES ($1, $2, $3, 0) RETURNING id",
    [username, email, hash]
  );
  const user   = await db.get("SELECT * FROM users WHERE id = $1", [result.lastId]);

  // Send verification OTP
  try {
    const otp = createOtp(user.id, "email_verification");
    await sendOtpEmail(email, otp, "email_verification");
  } catch (e) {
    console.error("[auth] Failed to send verification email:", e.message);
    // Don't fail registration — user can request resend
  }

  res.json({ requiresVerification: true, email });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password)
      return res.status(400).json({ error: "Username/email and password are required" });

    const user = await db.get(
      "SELECT * FROM users WHERE username = $1 OR email = $2",
      [identifier, identifier]
    );
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: "Invalid credentials" });

    if (!user.email_verified) {
      // Silently resend a fresh OTP so the user doesn't have to click "resend"
      try {
        const rate = await canResend(user.id, "email_verification");
        if (rate.allowed) {
          const otp = await createOtp(user.id, "email_verification");
          sendOtpEmail(user.email, otp, "email_verification").catch(() => {});
        }
      } catch {}
      return res.status(403).json({
        requiresVerification: true,
        email: user.email,
        error: "Please verify your email address before logging in.",
      });
    }

    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (e) { next(e); }
});

// ── POST /api/auth/verify-email ───────────────────────────────────────────────
router.post("/verify-email", async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return res.status(400).json({ error: "Email and code are required" });

    const user = await db.get("SELECT * FROM users WHERE email = $1", [email]);
    if (!user) return res.status(404).json({ error: "No account found with that email" });
    if (user.email_verified) {
      // Already verified — just log them in
      return res.json({ token: signToken(user.id), user: publicUser(user) });
    }

    const result = await verifyOtp(user.id, String(otp).trim(), "email_verification");
    if (!result.ok) return res.status(400).json({ error: result.error });

    await db.run("UPDATE users SET email_verified = 1 WHERE id = $1", [user.id]);
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (e) { next(e); }
});

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────
router.post("/resend-otp", async (req, res, next) => {
  try {
    const { email, purpose } = req.body || {};
    if (!email || !purpose) return res.status(400).json({ error: "Email and purpose are required" });
    if (!["email_verification", "password_reset"].includes(purpose))
      return res.status(400).json({ error: "Invalid purpose" });

    const user = await db.get("SELECT * FROM users WHERE email = $1", [email]);
    if (!user) {
      // Don't reveal whether email exists
      return res.json({ ok: true, message: "If an account exists, a code has been sent." });
    }

    const rate = await canResend(user.id, purpose);
    if (!rate.allowed)
      return res.status(429).json({ error: `Please wait ${rate.wait} seconds before requesting a new code.` });

    try {
      const otp = await createOtp(user.id, purpose);
      await sendOtpEmail(email, otp, purpose);
      res.json({ ok: true });
    } catch (e) {
      console.error("[auth] resend-otp error:", e.message);
      res.status(500).json({ error: "Failed to send email. Please try again." });
    }
  } catch (e) { next(e); }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await db.get("SELECT * FROM users WHERE email = $1", [email]);
    // Always return the same response to prevent email enumeration
    if (!user) return res.json({ ok: true });

    const rate = await canResend(user.id, "password_reset");
    if (!rate.allowed)
      return res.status(429).json({ error: `Please wait ${rate.wait} seconds before requesting a new code.` });

    try {
      const otp = await createOtp(user.id, "password_reset");
      await sendOtpEmail(email, otp, "password_reset");
    } catch (e) {
      console.error("[auth] forgot-password email error:", e.message);
      // Still return ok so as not to reveal email existence
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!email || !otp || !newPassword)
      return res.status(400).json({ error: "Email, code, and new password are required" });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });

    const user = await db.get("SELECT * FROM users WHERE email = $1", [email]);
    if (!user) return res.status(404).json({ error: "No account found with that email" });

    const result = await verifyOtp(user.id, String(otp).trim(), "password_reset");
    if (!result.ok) return res.status(400).json({ error: result.error });

    await db.run(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [bcrypt.hashSync(newPassword, 10), user.id]
    );
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (e) { next(e); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await db.get("SELECT * FROM users WHERE id = $1", [req.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

// ── PATCH /api/auth/password ──────────────────────────────────────────────────
router.patch("/password", authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: "Current and new password are required" });
    if (newPassword.length < 6)
      return res.status(400).json({ error: "New password must be at least 6 characters" });

    const user = await db.get("SELECT * FROM users WHERE id = $1", [req.userId]);
    if (!bcrypt.compareSync(currentPassword, user.password_hash))
      return res.status(401).json({ error: "Current password is incorrect" });

    await db.run(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [bcrypt.hashSync(newPassword, 10), req.userId]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
