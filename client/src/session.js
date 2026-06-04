// Tracks the in-progress session client-side so a refresh during practice resumes
// correctly. The session config is the source of truth; `startedAt` anchors the
// per-session countdown so it survives reloads.
const KEY = "varc_active_session";

export function loadActiveSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearActiveSession() {
  localStorage.removeItem(KEY);
}
