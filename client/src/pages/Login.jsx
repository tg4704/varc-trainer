import { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { AuthShell, AuthTabs, AuthDivider, GoogleButton, PasswordField } from "../components/AuthShell.jsx";

// Resolves the backend URL for Google OAuth redirect.
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
      <div className="card w-[420px] max-w-full p-[30px]">
        <AuthTabs active="login" />
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
                <Link to="/forgot-password" className="text-[12.5px]" style={{ color: "var(--teal)" }}>
                  Forgot password?
                </Link>
              </div>
            }
          />

          {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-primary btn-block mt-1">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <AuthDivider label="or" />
        <GoogleButton href={GOOGLE_AUTH_URL} />
      </div>
      <p className="mt-[18px] max-w-[360px] text-center text-xs leading-relaxed dim">
        By continuing you agree to our <a href="#" className="muted">Terms</a> and{" "}
        <a href="#" className="muted">Privacy Policy</a>.
      </p>
    </AuthShell>
  );
}
