import { track } from "./analytics.js";

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

// Routes where a 401 means something other than "your session expired" -
// login/register reject bad credentials with 401 before any token exists,
// and changing your password rejects a wrong *current* password with 401
// even though the request itself is properly authenticated. Excluded so a
// wrong password doesn't look like an expired session and bounce the user
// to the login screen.
const SESSION_EXPIRY_EXEMPT_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/password"];

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
    // A 402 means a plan limit was hit (daily cap or monthly kill-switch).
    // Carry the structured upgrade info on the error, and fire an app-wide
    // event so a global upgrade prompt can react wherever the call came from.
    if (res.status === 402) {
      err.reason = body.reason;
      err.tier = body.tier;
      err.upgradeTo = body.upgradeTo;
      err.upgradeName = body.upgradeName;
      window.dispatchEvent(new CustomEvent("graspr:limit-reached", { detail: body }));
    }
    // A 401 on an authenticated request (we had a token, this wasn't one of
    // the exempt routes above) means the token is dead - expired, or the
    // user was deleted/reset elsewhere. Surface it app-wide instead of
    // leaving a raw "jwt expired" error stuck on whatever screen the user
    // happened to be on mid-session.
    if (res.status === 401 && token && !SESSION_EXPIRY_EXEMPT_PATHS.includes(path)) {
      setToken(null);
      sessionStorage.setItem("graspr_session_expired", "1");
      window.dispatchEvent(new Event("graspr:session-expired"));
    }
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
export function acceptTerms() {
  return request("/api/auth/accept-terms", { method: "POST" });
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
  if (!payload.skipped) track("question_answered", { mode: payload.mode, deferred: false });
  return request("/api/attempts/basic", { method: "POST", body: JSON.stringify(payload) });
}
export function submitEvaluateAttempt(payload) {
  if (!payload.skipped) track("question_answered", { mode: payload.mode, deferred: Boolean(payload.deferred) });
  return request("/api/attempts/evaluate", { method: "POST", body: JSON.stringify(payload) });
}
// Re-run AI evaluation for an already-saved attempt whose first evaluation failed.
export function retryEvaluateAttempt(attemptId) {
  return request(`/api/attempts/${attemptId}/retry-evaluation`, { method: "POST" });
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

// Downloads the user's full data export as a .json file (DPDP data-portability right).
export async function exportAccountData() {
  const data = await request("/api/account/export");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "graspr-data-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

// ── Coach (② - restructure) ────────────────────────────
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
  setUserTier: (id, tier, months = 1) =>
    request(`/api/admin/users/${id}/tier`, { method: "PATCH", body: JSON.stringify({ tier, months }) }),
  // Immediately cancel the user's recurring subscription + drop to free now.
  forceCancelSubscription: (id) =>
    request(`/api/admin/users/${id}/force-cancel`, { method: "POST" }),
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
  // action: 'activate' | 'deactivate' | 'delete' ('delete' is a hard delete)
  bulkQuestions: (ids, action) =>
    request("/api/admin/questions/bulk", { method: "POST", body: JSON.stringify({ ids, action }) }),
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

  listPrompts: () => request("/api/admin/prompts"),
  savePrompt: (key, content) =>
    request(`/api/admin/prompts/${key}`, { method: "PUT", body: JSON.stringify({ content }) }),
  resetPrompt: (key) =>
    request(`/api/admin/prompts/${key}`, { method: "DELETE" }),

  listPassages: (active = "") =>
    request(`/api/admin/passages${active !== "" ? `?active=${active}` : ""}`),
  getPassage: (id) => request(`/api/admin/passages/${id}`),
  savePassage: (id, body) =>
    request(`/api/admin/passages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  // Activating/deactivating a passage cascades to its questions in both directions.
  setPassageActive: (id, isActive) =>
    request(`/api/admin/passages/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),

  // 'delete' moves each passage AND its questions to the trash (Admin → Deleted).
  bulkPassages: (ids, action) =>
    request("/api/admin/passages/bulk", { method: "POST", body: JSON.stringify({ ids, action }) }),

  // ── Trash (Admin → Deleted) ──────────────────────────────────────────────
  listTrash: () => request("/api/admin/trash"),
  restoreTrash: (kind, id) =>
    request(`/api/admin/trash/${kind}/${id}/restore`, { method: "POST" }),
  purgeTrash: (kind, id) =>
    request(`/api/admin/trash/${kind}/${id}`, { method: "DELETE" }),

  listBulletins: () => request("/api/admin/bulletins"),
  createBulletin: (title, body) =>
    request("/api/admin/bulletins", { method: "POST", body: JSON.stringify({ title, body }) }),
  saveBulletin: (id, title, body, isActive) =>
    request(`/api/admin/bulletins/${id}`, { method: "PUT", body: JSON.stringify({ title, body, isActive }) }),
  deleteBulletin: (id) =>
    request(`/api/admin/bulletins/${id}`, { method: "DELETE" }),
};

// ── Bulletins (public, active-only - for the logged-in homepage) ─────────────
export const bulletins = {
  list: () => request("/api/bulletins"),
};


// ── Billing (Razorpay) ─────────────────────────────────
export const billing = {
  // Public tier list for the pricing page.
  plans: () => request("/api/billing/plans"),
  // The signed-in user's current plan + expiry + today's usage.
  me: () => request("/api/billing/me"),
  // Captured purchase history, for the My Plan page's receipts list.
  payments: () => request("/api/billing/payments"),
  // Priced summary (amount, months, end date) for the pre-checkout review screen.
  // seasonYear only applies to period "cat" — picks which CAT season to buy
  // (e.g. 2026 or 2027). Omitted → the server's default (nearest on sale).
  quote: (tier, period = "monthly", seasonYear = null) =>
    request(
      `/api/billing/quote?tier=${encodeURIComponent(tier)}&period=${encodeURIComponent(period)}` +
      (seasonYear ? `&seasonYear=${encodeURIComponent(seasonYear)}` : "")
    ),
  // Start a purchase → returns Razorpay order details (or devMode order).
  // period: "monthly" | "cat" (one-time, till the season's end date).
  createOrder: (tier, period = "monthly", seasonYear = null) =>
    request("/api/billing/create-order", { method: "POST", body: JSON.stringify({ tier, period, seasonYear }) }),
  // Confirm a completed Checkout (order/payment/signature from Razorpay's handler).
  verify: (payload) =>
    request("/api/billing/verify", { method: "POST", body: JSON.stringify(payload) }),
  // Start a recurring monthly autopay subscription → Razorpay subscription_id.
  createSubscription: (tier) =>
    request("/api/billing/create-subscription", { method: "POST", body: JSON.stringify({ tier }) }),
  // Confirm the mandate (payment_id/subscription_id/signature from the handler).
  verifySubscription: (payload) =>
    request("/api/billing/verify-subscription", { method: "POST", body: JSON.stringify(payload) }),
  // Cancel the caller's active subscription at period end (no refund).
  cancelSubscription: () =>
    request("/api/billing/cancel-subscription", { method: "POST" }),
  // Dev-only: grant a tier without paying (disabled in production).
  devActivate: (tier, period = "monthly", seasonYear = null) =>
    request("/api/billing/dev-activate", { method: "POST", body: JSON.stringify({ tier, period, seasonYear }) }),
};
