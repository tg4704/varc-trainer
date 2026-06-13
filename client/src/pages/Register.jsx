import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { AuthShell, AuthTabs, AuthDivider, GoogleButton, PasswordField } from "../components/AuthShell.jsx";

const GOOGLE_AUTH_URL = `${import.meta.env.VITE_API_URL || ""}/api/auth/google`;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

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
      const result = await register(username.trim(), email.trim(), password);
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
      <div className="card w-[420px] max-w-full p-[30px]">
        <AuthTabs active="register" />
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}

          <button type="submit" disabled={busy} className="btn btn-primary btn-block mt-1">
            {busy ? "Creating…" : "Create account"}
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
