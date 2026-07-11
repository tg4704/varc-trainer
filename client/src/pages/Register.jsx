import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  AuthShell, AuthCard, AuthTabs, AuthDivider, AuthError, GoogleButton, PasswordField,
} from "../components/AuthShell.jsx";
import PageMeta from "../components/PageMeta.jsx";

const GOOGLE_AUTH_URL = `${import.meta.env.VITE_API_URL || ""}/api/auth/google`;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!agreed) {
      setError("Please confirm you're 18+ and agree to the Terms and Privacy Policy");
      return;
    }
    setBusy(true);
    try {
      const result = await register(username.trim(), email.trim(), password, name.trim());
      if (result.requiresVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(result.email)}`);
      } else {
        navigate("/setup", { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <PageMeta title="Sign up — Graspr" description="Create a free Graspr account and start training CAT VARC reading comprehension with AI feedback on every answer." />
      <AuthCard
        title="Create your account"
        subtitle="Start training your reasoning today."
      >
        <AuthTabs active="register" />
        <AuthError>{error}</AuthError>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">Name <span className="dim font-normal">(optional)</span></label>
            <input
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder="Tarun Mehta"
            />
          </div>
          <div>
            <label className="field-label">Username</label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              minLength={3}
              placeholder="yourname"
              required
            />
          </div>
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
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

          <label className="flex items-start gap-2.5 text-[13px] leading-snug muted">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-current"
              style={{ accentColor: "var(--teal)" }}
            />
            <span>
              I confirm I'm 18 or older and agree to the{" "}
              <Link to="/terms" target="_blank" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Terms</Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Privacy Policy</Link>.
            </span>
          </label>

          <button type="submit" disabled={busy || !agreed} className="btn btn-primary btn-block fx-sheen mt-1">
            {busy ? "Creating…" : <>Create account <span className="arrow inline-block">→</span></>}
          </button>
        </form>

        <AuthDivider label="or" />
        <GoogleButton href={GOOGLE_AUTH_URL} />

        <div className="mt-5 text-center text-[13px] muted">
          Already have an account?{" "}
          <Link to="/login" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
            Log in
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
