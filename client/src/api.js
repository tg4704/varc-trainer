// In dev, VITE_API_URL is unset and requests go to /api (proxied to :3001 by Vite).
// In production, VITE_API_URL points at the deployed backend.
const BASE = import.meta.env.VITE_API_URL || "";

const TOKEN_KEY = "varc_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────
export function register(payload) {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
}
export function login(payload) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
}
export function fetchMe() {
  return request("/api/auth/me");
}
export function changePassword(payload) {
  return request("/api/auth/password", { method: "PATCH", body: JSON.stringify(payload) });
}

// ── Sessions ──────────────────────────────────────────
export function createSession(config) {
  return request("/api/sessions", { method: "POST", body: JSON.stringify(config) });
}
export function getSession(sessionId) {
  return request(`/api/sessions/${sessionId}`);
}
export function getActiveSession() {
  return request("/api/sessions/active");
}
export function completeSession(sessionId) {
  return request(`/api/sessions/${sessionId}/complete`, { method: "POST" });
}
export function getSessionReview(sessionId) {
  return request(`/api/sessions/${sessionId}/review`);
}
export function batchEvaluateSession(sessionId) {
  return request(`/api/sessions/${sessionId}/batch-evaluate`, { method: "POST" });
}

// ── Questions & attempts ─────────────────────────────
export function getNextQuestion(sessionId) {
  return request(`/api/questions/next?sessionId=${sessionId}`);
}
export function submitBasicAttempt(payload) {
  return request("/api/attempts/basic", { method: "POST", body: JSON.stringify(payload) });
}
export function submitEvaluateAttempt(payload) {
  return request("/api/attempts/evaluate", { method: "POST", body: JSON.stringify(payload) });
}

// ── Dashboard ─────────────────────────────────────────
export function getDashboard() {
  return request("/api/dashboard");
}

// ── Account ───────────────────────────────────────────
export function resetAccount() {
  return request("/api/account/reset", { method: "DELETE" });
}

// ── My Questions (Phase 10) ───────────────────────────
export const myQuestions = {
  list: () => request("/api/my-questions"),
  get: (id) => request(`/api/my-questions/${id}`),
  create: (body) =>
    request("/api/my-questions", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/my-questions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id) => request(`/api/my-questions/${id}`, { method: "DELETE" }),
  generateDraft: (body) =>
    request("/api/my-questions/generate-draft", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ── Reading Coach (Phase 14) ──────────────────────────
export const coach = {
  createSession: (body) =>
    request("/api/coach/sessions", { method: "POST", body: JSON.stringify(body) }),
  exchange: (body) =>
    request("/api/coach/exchange", { method: "POST", body: JSON.stringify(body) }),
  getSession: (id) => request(`/api/coach/sessions/${id}`),
  history: () => request("/api/coach/history"),
  stats: () => request("/api/coach/stats"),
  saveToBank: (id) =>
    request(`/api/coach/sessions/${id}/save-to-bank`, { method: "POST" }),
};

// ── Admin (Phase 9) ───────────────────────────────────
// All admin endpoints require role='admin' on the user.
export const admin = {
  overview: () => request("/api/admin/overview"),

  listUsers: ({ q = "", page = 1, pageSize = 50 } = {}) => {
    const qs = new URLSearchParams({ q, page, pageSize }).toString();
    return request(`/api/admin/users?${qs}`);
  },
  getUser: (id) => request(`/api/admin/users/${id}`),
  getUserDashboard: (id) => request(`/api/admin/users/${id}/dashboard`),
  patchUser: (id, body) =>
    request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  resetUserData: (id) => request(`/api/admin/users/${id}/data`, { method: "DELETE" }),

  listQuestions: (filters = {}) => {
    const qs = new URLSearchParams(filters).toString();
    return request(`/api/admin/questions?${qs}`);
  },
  getQuestion: (id) => request(`/api/admin/questions/${id}`),
  createQuestion: (body) =>
    request("/api/admin/questions", { method: "POST", body: JSON.stringify(body) }),
  updateQuestion: (id, body) =>
    request(`/api/admin/questions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteQuestion: (id) =>
    request(`/api/admin/questions/${id}`, { method: "DELETE" }),
  flagQuestion: (id, reason) =>
    request(`/api/admin/questions/${id}/flag`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  listFlags: (status = "open") =>
    request(`/api/admin/flags?status=${encodeURIComponent(status)}`),
  resolveFlag: (id, resolution) =>
    request(`/api/admin/flags/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ resolution }),
    }),

  costs: () => request("/api/admin/costs"),
};

// ── Spaced Repetition (Phase 15) ─────────────────────────────────────────────
export const sr = {
  getQueue: () => request("/api/sr/queue"),
  getStats: () => request("/api/sr/stats"),
};

// ── Streaks & Daily Goals (Phase 16) ─────────────────────────────────────────
export const streak = {
  get: () => request("/api/streak"),
  setGoal: (dailyGoal) =>
    request("/api/streak/goal", { method: "PATCH", body: JSON.stringify({ dailyGoal }) }),
};
