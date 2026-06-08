import { lazy, Suspense } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { AuthProvider, useAuth } from "./auth.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminRoute from "./components/AdminRoute.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import SessionSetup from "./pages/SessionSetup.jsx";
import Practice from "./pages/Practice.jsx";
import Results from "./pages/Results.jsx";
import SessionReview from "./pages/SessionReview.jsx";
import Profile from "./pages/Profile.jsx";
import MyQuestions from "./pages/MyQuestions.jsx";
import MyQuestionEditor from "./pages/MyQuestionEditor.jsx";
import CoachLanding from "./pages/CoachLanding.jsx";
import CoachPractice from "./pages/CoachPractice.jsx";
import CoachSummary from "./pages/CoachSummary.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

// Admin pages — lazy-loaded so the bundle stays small for regular users.
const AdminLayout         = lazy(() => import("./pages/admin/AdminLayout.jsx"));
const AdminOverview       = lazy(() => import("./pages/admin/AdminOverview.jsx"));
const AdminUsers          = lazy(() => import("./pages/admin/AdminUsers.jsx"));
const AdminUserDetail     = lazy(() => import("./pages/admin/AdminUserDetail.jsx"));
const AdminUserDashboard  = lazy(() => import("./pages/admin/AdminUserDashboard.jsx"));
const AdminQuestions      = lazy(() => import("./pages/admin/AdminQuestions.jsx"));
const AdminQuestionEditor = lazy(() => import("./pages/admin/AdminQuestionEditor.jsx"));
const AdminCosts          = lazy(() => import("./pages/admin/AdminCosts.jsx"));
const AdminFlags          = lazy(() => import("./pages/admin/AdminFlags.jsx"));

function NavBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const link = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        pathname === to || (to !== "/" && pathname.startsWith(to))
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-border bg-card">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-foreground tracking-tight">
          VARC Trainer
        </Link>
        <div className="flex items-center gap-1">
          {user ? (
            <>
              {link("/setup", "Practice")}
              {link("/coach", "Coach")}
              {link("/dashboard", "Dashboard")}
              {link("/my-questions", "My Questions")}
              {user.role === "admin" && link("/admin", "Admin")}
              {link("/profile", user.username)}
            </>
          ) : (
            <>
              {link("/login", "Log in")}
              {link("/register", "Sign up")}
            </>
          )}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

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

function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="/my-questions"     element={<ProtectedRoute><MyQuestions /></ProtectedRoute>} />
          <Route path="/my-questions/new" element={<ProtectedRoute><MyQuestionEditor /></ProtectedRoute>} />
          <Route path="/my-questions/:id" element={<ProtectedRoute><MyQuestionEditor /></ProtectedRoute>} />

          {/* ── Reading Coach ────────────────────────────────────────── */}
          <Route path="/coach"          element={<ProtectedRoute><CoachLanding /></ProtectedRoute>} />
          <Route path="/coach/practice" element={<ProtectedRoute><CoachPractice /></ProtectedRoute>} />
          <Route path="/coach/summary"  element={<ProtectedRoute><CoachSummary /></ProtectedRoute>} />

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
            <Route path="costs"                element={<Suspense fallback={AdminLoading}><AdminCosts /></Suspense>} />
            <Route path="flags"                element={<Suspense fallback={AdminLoading}><AdminFlags /></Suspense>} />
          </Route>
        </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
