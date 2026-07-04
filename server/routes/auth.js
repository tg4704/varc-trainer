const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const crypto  = require("crypto");
const db      = require("../db");
const { signToken, authenticate } = require("../auth");
const { sendOtpEmail } = require("../email");

// ── Google OAuth config ───────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
const BACKEND_URL  = (process.env.BACKEND_URL  || "http://localhost:3001").replace(/\/$/, "");

// Stateless CSRF state: timestamp.HMAC — no session/cookie storage needed
function makeOAuthState() {
  const ts  = Date.now().toString(36);
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(ts).digest("hex").slice(0, 16);
  return `${ts}.${sig}`;
}
function verifyOAuthState(state) {
  if (!state || !state.includes(".")) return false;
  const dot = state.lastIndexOf(".");
  const ts  = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac("sha256", process.env.JWT_SECRET || "dev-secret")
    .update(ts).digest("hex").slice(0, 16);
  if (sig !== expected) return false;
  // Expire after 10 minutes
  return Date.now() - parseInt(ts, 36) < 10 * 60 * 1000;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name || null,
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
  const { username, email, password, name } = req.body || {};
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
    "INSERT INTO users (username, email, password_hash, name, email_verified) VALUES ($1, $2, $3, $4, 0) RETURNING id",
    [username, email, hash, (name || "").trim() || null]
  );
  const user   = await db.get("SELECT * FROM users WHERE id = $1", [result.lastId]);

  // Send verification OTP
  try {
    const otp = await createOtp(user.id, "email_verification");
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
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    // Google-only account (no password set)
    if (!user.password_hash) {
      return res.status(400).json({
        error: "This account uses Google sign-in. Please use the 'Continue with Google' button.",
      });
    }
    if (!bcrypt.compareSync(password, user.password_hash))
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

// ── GET /api/auth/google ──────────────────────────────────────────────────────
router.get("/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: "Google OAuth is not configured on this server." });
  }
  const state  = makeOAuthState();
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  `${BACKEND_URL}/api/auth/google/callback`,
    response_type: "code",
    scope:         "openid email profile",
    access_type:   "offline",
    prompt:        "select_account",
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// ── GET /api/auth/google/callback ─────────────────────────────────────────────
router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error === "access_denied") {
    return res.redirect(`${FRONTEND_URL}/login?error=google_cancelled`);
  }
  if (!verifyOAuthState(state)) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_state_invalid`);
  }
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_no_code`);
  }

  try {
    // 1. Exchange auth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  `${BACKEND_URL}/api/auth/google/callback`,
        grant_type:    "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[google oauth] token exchange failed:", tokens);
      return res.redirect(`${FRONTEND_URL}/login?error=google_token_failed`);
    }

    // 2. Get Google user profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const gUser = await profileRes.json();
    const { id: googleId, email, name } = gUser;

    if (!googleId || !email) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_no_email`);
    }

    // 3. Find or create user
    let user = await db.get("SELECT * FROM users WHERE google_id = $1", [googleId]);
    let isNewUser = false;

    if (!user) {
      // Check if email is already registered → link accounts
      user = await db.get("SELECT * FROM users WHERE email = $1", [email]);
      if (user) {
        await db.run(
          "UPDATE users SET google_id = $1, email_verified = 1 WHERE id = $2",
          [googleId, user.id]
        );
      } else {
        // New user — derive a unique username from their Google display name
        const base = (name || email.split("@")[0])
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 20) || "user";
        let username = base;
        let suffix   = 1;
        while (await db.get("SELECT 1 FROM users WHERE username = $1", [username])) {
          username = `${base}${suffix++}`;
        }
        const ins = await db.run(
          `INSERT INTO users (username, email, password_hash, google_id, name, email_verified, role)
           VALUES ($1, $2, NULL, $3, $4, 1, 'user') RETURNING id`,
          [username, email, googleId, name || null]
        );
        user = await db.get("SELECT * FROM users WHERE id = $1", [ins.lastId]);
        isNewUser = true;
      }
    }

    // Refresh user row (may have just been updated)
    user = await db.get("SELECT * FROM users WHERE id = $1", [user.id]);

    // 4. Issue JWT and redirect to frontend
    const token       = signToken(user.id);
    const userPayload = encodeURIComponent(JSON.stringify(publicUser(user)));
    // Signal brand-new users so they can confirm/edit their derived username
    const newUserFlag = isNewUser ? "&newUser=1" : "";
    res.redirect(`${FRONTEND_URL}/oauth-callback?token=${token}&user=${userPayload}${newUserFlag}`);
  } catch (err) {
    console.error("[google oauth] callback error:", err);
    res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await db.get("SELECT * FROM users WHERE id = $1", [req.userId]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

// ── GET /api/auth/username-available ────────────────────────────────────────────
router.get("/username-available", async (req, res, next) => {
  try {
    const u = (req.query.u || "").trim();
    if (!u || u.length < 3 || u.length > 30 || !/^[a-z0-9_]+$/i.test(u)) {
      return res.json({ available: false });
    }
    const existing = await db.get("SELECT 1 FROM users WHERE username = $1", [u]);
    res.json({ available: !existing });
  } catch (e) { next(e); }
});

// ── PATCH /api/auth/username ──────────────────────────────────────────────────
router.patch("/username", authenticate, async (req, res, next) => {
  try {
    const { username } = req.body || {};
    if (!username || username.length < 3 || username.length > 30 || !/^[a-z0-9_]+$/i.test(username)) {
      return res.status(400).json({ error: "Username must be 3–30 characters (letters, numbers, underscores)" });
    }
    const existing = await db.get(
      "SELECT 1 FROM users WHERE username = $1 AND id != $2",
      [username, req.userId]
    );
    if (existing) return res.status(409).json({ error: "That username is already taken" });
    await db.run("UPDATE users SET username = $1 WHERE id = $2", [username, req.userId]);
    const user = await db.get("SELECT * FROM users WHERE id = $1", [req.userId]);
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

// ── PATCH /api/auth/name ────────────────────────────────────────────────────
// Optional display name (powers "Good evening, {name}" greetings). Unlike
// username, not unique — trimmed, max 60 chars, empty string clears it to NULL.
router.patch("/name", authenticate, async (req, res, next) => {
  try {
    const raw = (req.body?.name ?? "").trim();
    if (raw.length > 60) {
      return res.status(400).json({ error: "Name must be 60 characters or fewer" });
    }
    await db.run("UPDATE users SET name = $1 WHERE id = $2", [raw || null, req.userId]);
    const user = await db.get("SELECT * FROM users WHERE id = $1", [req.userId]);
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
    if (!user.password_hash) {
      return res.status(400).json({
        error: "This account uses Google sign-in and has no password. Use 'Forgot password' to set one.",
      });
    }
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
