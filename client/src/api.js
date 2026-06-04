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
