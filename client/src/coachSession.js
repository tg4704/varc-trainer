// localStorage helpers for the active VARC Coach session.
// Mirrors the pattern in session.js for practice sessions.
const KEY = "varc_active_coach_session";

export function saveActiveCoachSession(sessionId) {
  localStorage.setItem(KEY, String(sessionId));
}

export function getActiveCoachSessionId() {
  return localStorage.getItem(KEY) || null;
}

export function clearActiveCoachSession() {
  localStorage.removeItem(KEY);
}
