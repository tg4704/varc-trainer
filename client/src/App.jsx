import { lazy, Suspense } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import SessionSetup from "./pages/SessionSetup.jsx";
import Practice from "./pages/Practice.jsx";
import Results from "./pages/Results.jsx";
import Profile from "./pages/Profile.jsx";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

function NavBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const link = (to, label) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        pathname === to
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
              {link("/dashboard", "Dashboard")}
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

function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SessionSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice"
            element={
              <ProtectedRoute>
                <Practice />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results"
            element={
              <ProtectedRoute>
                <Results />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Suspense fallback={
                  <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[1, 2, 3, 4].map((i) => <div key={i} className="rounded-xl bg-slate-100 h-24" />)}
                    </div>
                    <div className="rounded-xl bg-slate-100 h-48" />
                  </div>
                }>
                  <Dashboard />
                </Suspense>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
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
