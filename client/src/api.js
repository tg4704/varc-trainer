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
export function checkUsernameAvailable(username) {
  return request(`/api/auth/username-available?u=${encodeURIComponent(username)}`);
}
export function changeUsername(username) {
  return request("/api/auth/username", { method: "PATCH", body: JSON.stringify({ username }) });
}
export function changeName(name) {
  return request("/api/auth/name", { method: "PATCH", body: JSON.stringify({ name }) });
}
export function changeAvatar(avatarId) {
  return request("/api/auth/avatar", { method: "PATCH", body: JSON.stringify({ avatarId }) });
}
export function updateStudentProfile({ favoriteTopic, bio }) {
  return request("/api/auth/profile", { method: "PATCH", body: JSON.stringify({ favoriteTopic, bio }) });
}
export function verifyEmail(payload) {
  return request("/api/auth/verify-email", { method: "POST", body: JSON.stringify(payload) });
}
export function resendOtp(payload) {
  return request("/api/auth/resend-otp", { method: "POST", body: JSON.stringify(payload) });
}
export function forgotPassword(payload) {
  return request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) });
}
export function resetPassword(payload) {
  return request("/api/auth/reset-password", { method: "POST", body: JSON.stringify(payload) });
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
export function deleteSession(sessionId) {
  return request(`/api/sessions/${sessionId}`, { method: "DELETE" });
}
export function getSessionReview(sessionId) {
  return request(`/api/sessions/${sessionId}/review`);
}
export function getSessionQuestions(sessionId) {
  return request(`/api/sessions/${sessionId}/questions`);
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
export function getDashboardTrend(range = "30d") {
  return request(`/api/dashboard/trend?range=${encodeURIComponent(range)}`);
}
export function getDashboardHeatmap() {
  return request("/api/dashboard/heatmap");
}

// ── Question flagging (user) ──────────────────────────
export function flagQuestion(questionId, reason, note) {
  return request(`/api/questions/${questionId}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason, note }),
  });
}

// ── Account ───────────────────────────────────────────
export function resetAccount() {
  return request("/api/account/reset", { method: "DELETE" });
}
export function deleteAccount() {
  return request("/api/account", { method: "DELETE" });
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

// ── Coach (② — restructure) ────────────────────────────
export const coach = {
  listPassages: (topic = "") =>
    request(`/api/coach/passages${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`),
  createSession: (passageId) =>
    request("/api/coach/sessions", { method: "POST", body: JSON.stringify({ passageId }) }),
  getSession: (id) => request(`/api/coach/sessions/${id}`),
  submitReadingMap: (sessionId, body) =>
    request(`/api/coach/sessions/${sessionId}/reading-map`, { method: "POST", body: JSON.stringify(body) }),
  submitAttempt: (body) =>
    request("/api/coach/attempts", { method: "POST", body: JSON.stringify(body) }),
  exchange: (body) =>
    request("/api/coach/exchange", { method: "POST", body: JSON.stringify(body) }),
  completeSession: (id) =>
    request(`/api/coach/sessions/${id}/complete`, { method: "POST" }),
  history: () => request("/api/coach/history"),
  stats: () => request("/api/coach/stats"),
  deleteSession: (id) =>
    request(`/api/coach/sessions/${id}`, { method: "DELETE" }),
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

  apiCalls: (filters = {}) => {
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v != null));
    const qs = new URLSearchParams(clean).toString();
    return request(`/api/admin/api-calls${qs ? `?${qs}` : ""}`);
  },

  importContent: (payload) =>
    request("/api/admin/import", { method: "POST", body: JSON.stringify(payload) }),

  listPassages: (active = "") =>
    request(`/api/admin/passages${active !== "" ? `?active=${active}` : ""}`),
  setPassageActive: (id, isActive) =>
    request(`/api/admin/passages/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
};

