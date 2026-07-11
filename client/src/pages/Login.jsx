import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  AuthShell, AuthCard, AuthTabs, AuthDivider, AuthError, GoogleButton, PasswordField,
} from "../components/AuthShell.jsx";
import PageMeta from "../components/PageMeta.jsx";

const GOOGLE_AUTH_URL = `${import.meta.env.VITE_API_URL || ""}/api/auth/google`;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from || "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("oauthError") || null);
  const [busy, setBusy] = useState(false);

  // Set by api.js when a 401 mid-session means the token died (expired, or
  // the account changed elsewhere) — distinct from a normal logout, so the
  // message reassures the user their in-progress session is still there.
  // Read in an effect, not a useState lazy initializer: the initializer runs
  // twice under React 18 StrictMode in dev, and its sessionStorage.removeItem
  // side effect would consume the flag on the throwaway first call.
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem("graspr_session_expired")) {
      sessionStorage.removeItem("graspr_session_expired");
      setSessionExpired(true);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login(identifier.trim(), password);
      if (result.requiresVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <PageMeta title="Log in — Graspr" description="Sign in to Graspr to keep training CAT VARC reading comprehension." />
      <AuthCard
        title="Welcome back"
        subtitle="Sign in to keep your streak alive."
        footer={<>By continuing you agree to our <span className="muted">Terms</span> and <span className="muted">Privacy Policy</span>.</>}
      >
        <AuthTabs active="login" />
        {sessionExpired && !error && (
          <div
            className="mb-4 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px]"
            style={{ background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.35)", color: "var(--teal)" }}
          >
            Your session timed out. Log back in to pick up right where you left off.
          </div>
        )}
        <AuthError>{error}</AuthError>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">Email or username</label>
            <input
              className="input"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="you@email.com"
              required
            />
          </div>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            hint={
              <div className="mt-1.5 text-right">
                <Link to="/forgot-password" className="fx-underline text-[12px]" style={{ color: "var(--teal)" }}>
                  Forgot?
                </Link>
              </div>
            }
          />

          <button type="submit" disabled={busy} className="btn btn-primary btn-block fx-sheen mt-1">
            {busy ? "Signing in…" : <>Log in <span className="arrow inline-block">→</span></>}
          </button>
        </form>

        <AuthDivider label="or" />
        <GoogleButton href={GOOGLE_AUTH_URL} />

        <div className="mt-5 text-center text-[13px] muted">
          New here?{" "}
          <Link to="/register" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
            Create an account
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
