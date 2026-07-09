import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import TopNav from "./components/TopNav.jsx";
import { AuthProvider } from "./auth.jsx";
import { NavGuardProvider } from "./navGuard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import Home from "./pages/Home.jsx";
import Pricing from "./pages/Pricing.jsx";
import Blog from "./pages/Blog.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import OAuthCallback from "./pages/OAuthCallback.jsx";
import SessionSetup from "./pages/SessionSetup.jsx";
import Practice from "./pages/Practice.jsx";
import Results from "./pages/Results.jsx";
import SessionReview from "./pages/SessionReview.jsx";
import Profile from "./pages/Profile.jsx";
import ProfileCustomize from "./pages/ProfileCustomize.jsx";
// My Questions is temporarily disabled (see routes below) — imports dropped
// so its chunk isn't pulled into the main bundle. Re-add when re-enabling.
import CoachLanding from "./pages/CoachLanding.jsx";
import CoachPractice from "./pages/CoachPractice.jsx";
import CoachSummary from "./pages/CoachSummary.jsx";
import CoachHistory from "./pages/CoachHistory.jsx";
import ChooseUsername from "./pages/ChooseUsername.jsx";

// Wraps React.lazy so a failed chunk import (stale client after a new deploy —
// the old chunk hash no longer exists on the server) triggers a one-time full
// reload to fetch the fresh index.html + matching chunks, instead of crashing.
// A sessionStorage flag prevents an infinite reload loop on a genuine failure.
function lazyWithReload(factory) {
  return lazy(() =>
    factory().catch((err) => {
      const KEY = "chunk_reload_once";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
        return new Promise(() => {}); // hang until reload takes over
      }
      throw err;
    })
  );
}

const Dashboard = lazyWithReload(() => import("./pages/Dashboard.jsx"));

// Admin pages — lazy-loaded so the bundle stays small for regular users.
const AdminLayout         = lazyWithReload(() => import("./pages/admin/AdminLayout.jsx"));
const AdminOverview       = lazyWithReload(() => import("./pages/admin/AdminOverview.jsx"));
const AdminUsers          = lazyWithReload(() => import("./pages/admin/AdminUsers.jsx"));
const AdminUserDetail     = lazyWithReload(() => import("./pages/admin/AdminUserDetail.jsx"));
const AdminUserDashboard  = lazyWithReload(() => import("./pages/admin/AdminUserDashboard.jsx"));
const AdminQuestions      = lazyWithReload(() => import("./pages/admin/AdminQuestions.jsx"));
const AdminQuestionEditor = lazyWithReload(() => import("./pages/admin/AdminQuestionEditor.jsx"));
const AdminPassages       = lazyWithReload(() => import("./pages/admin/AdminPassages.jsx"));
const AdminImport         = lazyWithReload(() => import("./pages/admin/AdminImport.jsx"));
const AdminCosts          = lazyWithReload(() => import("./pages/admin/AdminCosts.jsx"));
const AdminFlags          = lazyWithReload(() => import("./pages/admin/AdminFlags.jsx"));

const DashboardSkeleton = (
  <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-xl bg-muted h-24" />)}
    </div>
    <div className="rounded-xl bg-muted h-48" />
  </div>
);

const AdminLoading = (
  <div className="max-w-6xl mx-auto px-4 py-16 text-center text-muted-foreground">
    Loading admin…
  </div>
);

// One universal top nav (TopNav) for every logged-in, non-session page — no
// persistent nav on the auth family (AuthShell shows its own brand mark).
// /practice and /coach/practice each render their own minimal in-session top
// bar internally (SessionTopBar / CoachSessionTopBar) — Exit + progress,
// no persistent app nav while a session is in progress.
const NO_NAV_ROUTES = [
  "/login", "/register", "/verify-email", "/forgot-password", "/reset-password",
  "/choose-username", "/oauth-callback",
  "/practice", "/coach/practice",
];

function AppNav() {
  const { pathname } = useLocation();
  if (NO_NAV_ROUTES.includes(pathname)) return null;
  return <TopNav />;
}

function AppShell() {
  return (
    <NavGuardProvider>
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <main>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/oauth-callback" element={<OAuthCallback />} />
          <Route path="/setup"     element={<ProtectedRoute><SessionSetup /></ProtectedRoute>} />
          <Route path="/practice"  element={<ProtectedRoute><Practice /></ProtectedRoute>} />
          <Route path="/results"        element={<ProtectedRoute><Results /></ProtectedRoute>} />
          <Route path="/session-review" element={<ProtectedRoute><SessionReview /></ProtectedRoute>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Suspense fallback={DashboardSkeleton}><Dashboard /></Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/customize" element={<ProtectedRoute><ProfileCustomize /></ProtectedRoute>} />
          {/* My Questions temporarily disabled — routes redirect to Dashboard
              rather than 404ing on any old bookmarked/shared links. */}
          <Route path="/my-questions"     element={<Navigate to="/dashboard" replace />} />
          <Route path="/my-questions/new" element={<Navigate to="/dashboard" replace />} />
          <Route path="/my-questions/:id" element={<Navigate to="/dashboard" replace />} />

          {/* ── VARC Coach ──────────────────────────────────────────── */}
          <Route path="/coach"          element={<ProtectedRoute><CoachLanding /></ProtectedRoute>} />
          <Route path="/coach/practice" element={<ProtectedRoute><CoachPractice /></ProtectedRoute>} />
          <Route path="/coach/summary"  element={<ProtectedRoute><CoachSummary /></ProtectedRoute>} />
          <Route path="/coach/history"  element={<ProtectedRoute><CoachHistory /></ProtectedRoute>} />

          {/* ── Auth extras ──────────────────────────────────────────── */}
          <Route path="/choose-username" element={<ProtectedRoute><ChooseUsername /></ProtectedRoute>} />

          {/* ── Admin ───────────────────────────────────────────────── */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Suspense fallback={AdminLoading}><AdminLayout /></Suspense>
              </AdminRoute>
            }
          >
            <Route index                       element={<Suspense fallback={AdminLoading}><AdminOverview /></Suspense>} />
            <Route path="users"                element={<Suspense fallback={AdminLoading}><AdminUsers /></Suspense>} />
            <Route path="users/:id"            element={<Suspense fallback={AdminLoading}><AdminUserDetail /></Suspense>} />
            <Route path="users/:id/dashboard"  element={<Suspense fallback={AdminLoading}><AdminUserDashboard /></Suspense>} />
            <Route path="questions"            element={<Suspense fallback={AdminLoading}><AdminQuestions /></Suspense>} />
            <Route path="questions/new"        element={<Suspense fallback={AdminLoading}><AdminQuestionEditor /></Suspense>} />
            <Route path="questions/:id"        element={<Suspense fallback={AdminLoading}><AdminQuestionEditor /></Suspense>} />
            <Route path="passages"             element={<Suspense fallback={AdminLoading}><AdminPassages /></Suspense>} />
            <Route path="import"               element={<Suspense fallback={AdminLoading}><AdminImport /></Suspense>} />
            <Route path="costs"                element={<Suspense fallback={AdminLoading}><AdminCosts /></Suspense>} />
            <Route path="flags"                element={<Suspense fallback={AdminLoading}><AdminFlags /></Suspense>} />
          </Route>
        </Routes>
        </ErrorBoundary>
      </main>
    </div>
    </NavGuardProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
