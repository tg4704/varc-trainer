const express = require("express");
const router = express.Router();
const db = require("../db");
const { authenticate } = require("../auth");

// GET /api/bulletins - active bulletins for the logged-in homepage's
// "important updates" box, newest first.
router.get("/", authenticate, async (req, res, next) => {
  try {
    const rows = await db.all(
      `SELECT id, title, body, created_at
         FROM bulletins
        WHERE is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 5`
    );
    res.json({ bulletins: rows });
  } catch (e) { next(e); }
});

module.exports = router;
