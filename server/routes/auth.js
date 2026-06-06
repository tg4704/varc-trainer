const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../db");
const { signToken, authenticate } = require("../auth");

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

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required" });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email address" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existing = db
    .prepare("SELECT id, username, email FROM users WHERE username = ? OR email = ?")
    .get(username, email);
  if (existing) {
    const field = existing.email === email ? "email" : "username";
    return res.status(409).json({ error: `That ${field} is already registered` });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
    .run(username, email, hash);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// POST /api/auth/login — identifier may be username OR email
router.post("/login", (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ error: "Username/email and password are required" });
  }
  const user = db
    .prepare("SELECT * FROM users WHERE username = ? OR email = ?")
    .get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

// PATCH /api/auth/password
router.patch("/password", authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    bcrypt.hashSync(newPassword, 10),
    req.userId
  );
  res.json({ ok: true });
});

module.exports = router;
