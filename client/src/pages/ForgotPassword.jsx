import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { forgotPassword } from "../api.js";
import { AuthShell, AuthCard, AuthError } from "../components/AuthShell.jsx";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await forgotPassword({ email: email.trim() });
      // Always navigate — server doesn't reveal if email exists
      navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        title="Forgot password"
        subtitle="Enter your email and we'll send a 6-digit code to reset it."
      >
        <AuthError>{error}</AuthError>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@email.com"
              required
            />
          </div>

          <button type="submit" disabled={busy} className="btn btn-primary btn-block fx-sheen mt-1">
            {busy ? "Sending…" : <>Send reset code <span className="arrow inline-block">→</span></>}
          </button>
        </form>

        <div className="mt-5 text-center text-[13px] muted">
          Remember it?{" "}
          <Link to="/login" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
            Log in
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
