// Persists passage annotations (highlight / underline / note) across reloads.
//
// Annotations live in Practice's per-question React state, which is rebuilt
// from scratch on every mount — so without this, a refresh mid-session wipes
// every mark the student made while reading. They are deliberately NOT sent to
// the server: they're private reading scaffolding, not attempt data, and they
// only mean anything against the exact passage string they were made over.
//
// Keyed by session, then by question id (not index — a session's question list
// is filtered server-side, so indices can shift).

const KEY = "varc_annotations";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// → { [questionId]: Annotation[] } for one session ({} if none stored).
export function loadAnnotations(sessionId) {
  if (!sessionId) return {};
  const all = readAll();
  return all[sessionId] || {};
}

export function saveAnnotations(sessionId, byQuestionId) {
  if (!sessionId) return;
  try {
    const all = readAll();
    const hasAny = Object.values(byQuestionId).some((list) => list && list.length > 0);
    if (hasAny) all[sessionId] = byQuestionId;
    else delete all[sessionId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Quota or private-mode failure — annotations are a nicety, never block on this.
  }
}

export function clearAnnotations(sessionId) {
  try {
    const all = readAll();
    delete all[sessionId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
