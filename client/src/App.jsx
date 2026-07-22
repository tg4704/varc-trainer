import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import DashboardSkeleton from "./components/DashboardSkeleton.jsx";
import TopNav from "./components/TopNav.jsx";
import CookieConsent from "./components/CookieConsent.jsx";
import UpgradePrompt from "./components/UpgradePrompt.jsx";
import { AuthProvider } from "./auth.jsx";
import { NavGuardProvider } from "./navGuard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import Home from "./pages/Home.jsx";
import Pricing from "./pages/Pricing.jsx";
import Blog from "./pages/Blog.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Refunds from "./pages/Refunds.jsx";
import Cookies from "./pages/Cookies.jsx";
import FAQ from "./pages/FAQ.jsx";
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
import MyPlan from "./pages/MyPlan.jsx";
// My Questions is temporarily disabled (see routes below) - imports dropped
// so its chunk isn't pulled into the main bundle. Re-add when re-enabling.
import CoachLanding from "./pages/CoachLanding.jsx";
import CoachPractice from "./pages/CoachPractice.jsx";
import CoachSummary from "./pages/CoachSummary.jsx";
import CoachHistory from "./pages/CoachHistory.jsx";
import ChooseUsername from "./pages/ChooseUsername.jsx";
import NotFound from "./pages/NotFound.jsx";

// Wraps React.lazy so a failed chunk import (stale client after a new deploy -
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

// Admin pages - lazy-loaded so the bundle stays small for regular users.
const AdminLayout         = lazyWithReload(() => import("./pages/admin/AdminLayout.jsx"));
const AdminOverview       = lazyWithReload(() => import("./pages/admin/AdminOverview.jsx"));
const AdminUsers          = lazyWithReload(() => import("./pages/admin/AdminUsers.jsx"));
const AdminUserDetail     = lazyWithReload(() => import("./pages/admin/AdminUserDetail.jsx"));
const AdminUserDashboard  = lazyWithReload(() => import("./pages/admin/AdminUserDashboard.jsx"));
const AdminQuestions      = lazyWithReload(() => import("./pages/admin/AdminQuestions.jsx"));
const AdminQuestionEditor = lazyWithReload(() => import("./pages/admin/AdminQuestionEditor.jsx"));
const AdminPassages       = lazyWithReload(() => import("./pages/admin/AdminPassages.jsx"));
const AdminPassageDetail  = lazyWithReload(() => import("./pages/admin/AdminPassageDetail.jsx"));
const AdminTrash          = lazyWithReload(() => import("./pages/admin/AdminTrash.jsx"));
const AdminImport         = lazyWithReload(() => import("./pages/admin/AdminImport.jsx"));
const AdminCosts          = lazyWithReload(() => import("./pages/admin/AdminCosts.jsx"));
const AdminPrompts        = lazyWithReload(() => import("./pages/admin/AdminPrompts.jsx"));
const AdminBulletins      = lazyWithReload(() => import("./pages/admin/AdminBulletins.jsx"));
const AdminLogs           = lazyWithReload(() => import("./pages/admin/AdminLogs.jsx"));
const AdminFlags          = lazyWithReload(() => import("./pages/admin/AdminFlags.jsx"));

const AdminLoading = (
  <div className="max-w-6xl mx-auto px-4 py-16 text-center text-muted-foreground">
    Loading admin…
  </div>
);

// One universal top nav (TopNav) for every logged-in, non-session page - no
// persistent nav on the auth family (AuthShell shows its own brand mark).
// /practice and /coach/practice each render their own minimal in-session top
// bar internally (SessionTopBar / CoachSessionTopBar) - Exit + progress,
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

// React Router v6 does not reset scroll on navigation - without this, a new
// route mounts already scrolled to the previous page's offset. Keyed on
// pathname only (not hash) so in-page anchor links (e.g. /#toolkit) still work.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      // Anchor navigation (e.g. arriving at /#why from another page): wait a
      // frame for the target section to mount, then scroll it into view.
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function AppShell() {
  return (
    <NavGuardProvider>
    <ScrollToTop />
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <main>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route path="/faq" element={<FAQ />} />
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
                <Suspense fallback={<DashboardSkeleton />}><Dashboard /></Suspense>
              </ProtectedRoute>
            }
          />
          <Route path="/profile"         element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/profile/customize" element={<ProtectedRoute><ProfileCustomize /></ProtectedRoute>} />
          <Route path="/my-plan"         element={<ProtectedRoute><MyPlan /></ProtectedRoute>} />
          {/* My Questions temporarily disabled - routes redirect to Dashboard
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
            <Route path="passages/:id"         element={<Suspense fallback={AdminLoading}><AdminPassageDetail /></Suspense>} />
            <Route path="deleted"              element={<Suspense fallback={AdminLoading}><AdminTrash /></Suspense>} />
            <Route path="import"               element={<Suspense fallback={AdminLoading}><AdminImport /></Suspense>} />
            <Route path="costs"                element={<Suspense fallback={AdminLoading}><AdminCosts /></Suspense>} />
            <Route path="prompts"              element={<Suspense fallback={AdminLoading}><AdminPrompts /></Suspense>} />
            <Route path="bulletins"            element={<Suspense fallback={AdminLoading}><AdminBulletins /></Suspense>} />
            <Route path="logs"                 element={<Suspense fallback={AdminLoading}><AdminLogs /></Suspense>} />
            <Route path="flags"                element={<Suspense fallback={AdminLoading}><AdminFlags /></Suspense>} />
          </Route>

          {/* Catch-all 404 - must stay last so it only matches unknown URLs. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </ErrorBoundary>
      </main>
      <CookieConsent />
      <UpgradePrompt />
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
