const express = require("express");
const router = express.Router();
const db = require("../db");
const questionsRepo = require("../questionsRepo");
const { authenticate } = require("../auth");
const { updateCard } = require("../sr");

// Calculate intuition-mode points (server-side, spec §Phase 6)
function calcIntuitionPoints({ isCorrect, timeTakenSeconds, eliminatedIndices, correctIndex, skipped }) {
  if (skipped) return -2; // time ran out
  let pts = 0;
  if (isCorrect) {
    pts += 10;
    if (timeTakenSeconds != null && timeTakenSeconds < 30) pts += 3;
  }
  if (eliminatedIndices && eliminatedIndices.length > 0) {
    for (const idx of eliminatedIndices) {
      if (idx === correctIndex) {
        pts -= 5; // eliminated the correct answer — heavy penalty
      } else {
        pts += 2; // correct elimination of a wrong option
      }
    }
  }
  return pts;
}

// POST /api/attempts/basic — record an answer or a skip
router.post("/basic", authenticate, async (req, res, next) => {
  try {
    const {
      sessionId,
      questionId,
      selectedOptionIndex,
      timeTakenSeconds,
      mode = "analysis",
      skipped = false,
      eliminatedIndices = [],
    } = req.body || {};

    if (sessionId == null || !questionId) {
      return res.status(400).json({ error: "sessionId and questionId are required" });
    }
    if (!skipped && selectedOptionIndex == null) {
      return res.status(400).json({ error: "selectedOptionIndex is required unless skipped" });
    }

    const session = await db.get(
      "SELECT * FROM sessions WHERE id = $1 AND user_id = $2",
      [sessionId, req.userId]
    );
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const q = await questionsRepo.findById(questionId);
    if (!q) {
      return res.status(404).json({ error: "Question not found" });
    }

    const isSkipped = skipped ? 1 : 0;
    const sel = isSkipped ? null : selectedOptionIndex;
    const isCorrect = !isSkipped && sel === q.correctIndex ? 1 : 0;
    const selectedTrap = !isSkipped && sel === q.trapIndex ? 1 : 0;

    const elimArr = Array.isArray(eliminatedIndices) ? eliminatedIndices : [];
    const elimJson = elimArr.length > 0 ? JSON.stringify(elimArr) : null;

    let intuitionPoints = null;
    if (mode === "intuition") {
      intuitionPoints = calcIntuitionPoints({
        isCorrect: isCorrect === 1,
        timeTakenSeconds,
        eliminatedIndices: elimArr,
        correctIndex: q.correctIndex,
        skipped: isSkipped === 1,
      });
    }

    await db.run(
      `INSERT INTO attempts
         (session_id, question_id, question_type, topic,
          selected_option_index, correct_option_index, is_correct,
          trap_option_index, trap_type, selected_trap, skipped,
          mode, time_taken_seconds, eliminated_indices, intuition_points)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        sessionId, questionId, q.type, q.topic,
        sel, q.correctIndex, isCorrect,
        q.trapIndex, q.trapType, selectedTrap, isSkipped,
        mode, timeTakenSeconds ?? null, elimJson, intuitionPoints,
      ]
    );

    // Update SR card for non-skipped attempts (Phase 15)
    if (!isSkipped) {
      try { await updateCard(req.userId, questionId, isCorrect === 1); } catch {}
    }

    res.json({
      isCorrect: isCorrect === 1,
      skipped: isSkipped === 1,
      correctOptionIndex: q.correctIndex,
      trapOptionIndex: q.trapIndex,
      trapType: q.trapType,
      selectedTrap: selectedTrap === 1,
      intuitionPoints,
    });
  } catch (e) { next(e); }
});

module.exports = router;
