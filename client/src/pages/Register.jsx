import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import {
  AuthShell, AuthCard, AuthTabs, AuthDivider, AuthError, GoogleButton, PasswordField,
} from "../components/AuthShell.jsx";

const GOOGLE_AUTH_URL = `${import.meta.env.VITE_API_URL || ""}/api/auth/google`;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
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
      <AuthCard
        title="Create your account"
        subtitle="Start training your reasoning today."
        footer={<>By continuing you agree to our <span className="muted">Terms</span> and <span className="muted">Privacy Policy</span>.</>}
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

          <button type="submit" disabled={busy} className="btn btn-primary btn-block fx-sheen mt-1">
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
