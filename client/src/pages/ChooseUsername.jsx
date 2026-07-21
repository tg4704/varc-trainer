// Shown to brand-new Google sign-in users so they can confirm/edit their derived username.
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { checkUsernameAvailable, changeUsername, acceptTerms } from "../api.js";
import { AuthShell, AuthCard, AuthError } from "../components/AuthShell.jsx";
import { AUTH } from "../lib/limits.js";

const USERNAME_RE = /^[a-z0-9_]+$/i;

export default function ChooseUsername() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState(user?.username || "");
  const [available, setAvailable] = useState(null); // null | true | false
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);

  // Debounced availability check
  useEffect(() => {
    if (!value || value === user?.username) { setAvailable(null); return; }
    if (value.length < 3 || !USERNAME_RE.test(value)) { setAvailable(false); return; }
    const t = setTimeout(async () => {
      setChecking(true);
      try {
        const { available: ok } = await checkUsernameAvailable(value);
        setAvailable(ok);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, user?.username]);

  async function handleSave() {
    if (!value || available === false || saving || !agreed) return;
    setSaving(true);
    setError(null);
    try {
      await acceptTerms();
      const { user: updated } = await changeUsername(value);
      updateUser(updated);
      navigate("/setup", { replace: true });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (saving || !agreed) return;
    setSaving(true);
    setError(null);
    try {
      await acceptTerms();
      navigate("/setup", { replace: true });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const statusColor = available === true ? "var(--green)" : available === false ? "var(--red)" : "var(--text-2)";
  const statusText  = checking ? "Checking…" : available === true ? "Available ✓" : available === false ? "Not available" : "";
  const canSave     = value && value.length >= 3 && USERNAME_RE.test(value) && available !== false && !saving && !checking && agreed;

  return (
    <AuthShell>
      <AuthCard
        title="Choose your username"
        subtitle="This is how you'll appear on the platform. You can change it later in your profile."
      >
        <AuthError>{error}</AuthError>

        <div>
          <label className="field-label">Username</label>
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value.trim()); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            minLength={AUTH.USERNAME_MIN}
            maxLength={AUTH.USERNAME_MAX}
            autoFocus
            className="input"
            placeholder="e.g. ravi_sharma"
          />
          <div className="mt-1.5 text-xs" style={{ color: statusColor }}>{statusText || " "}</div>
          <p className="text-xs dim mt-0.5">3–30 characters. Letters, numbers, underscores only.</p>
        </div>

        <label className="mt-5 flex items-start gap-2.5 text-[13px] leading-snug muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => { setAgreed(e.target.checked); setError(null); }}
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ accentColor: "var(--teal)" }}
          />
          <span>
            I confirm I'm 18 or older and agree to the{" "}
            <Link to="/terms" target="_blank" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" target="_blank" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>Privacy Policy</Link>.
          </span>
        </label>

        <div className="mt-6 flex gap-3">
          <button className="btn btn-primary flex-1 fx-sheen" disabled={!canSave} onClick={handleSave}>
            {saving ? "Saving…" : <>Continue <span className="arrow inline-block">→</span></>}
          </button>
          <button className="btn btn-glass" disabled={!agreed || saving} onClick={handleSkip}>
            Skip
          </button>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
