// Shown to brand-new Google sign-in users so they can confirm/edit their derived username.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { checkUsernameAvailable, changeUsername } from "../api.js";
import { Button } from "../components/ui/button.jsx";

const USERNAME_RE = /^[a-z0-9_]+$/i;

export default function ChooseUsername() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState(user?.username || "");
  const [available, setAvailable] = useState(null); // null | true | false
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
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
    if (!value || available === false || saving) return;
    setSaving(true);
    setError(null);
    try {
      const { user: updated } = await changeUsername(value);
      updateUser(updated);
      navigate("/setup", { replace: true });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const statusColor = available === true ? "text-green-600" : available === false ? "text-destructive" : "text-muted-foreground";
  const statusText  = checking ? "Checking…" : available === true ? "Available ✓" : available === false ? "Not available" : "";
  const canSave     = value && value.length >= 3 && USERNAME_RE.test(value) && available !== false && !saving && !checking;

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-foreground">Choose your username</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        This is how you'll appear on the platform. You can change it later in your profile.
      </p>

      <div className="mt-6">
        <label className="block text-sm font-semibold text-foreground mb-1">Username</label>
        <input
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value.trim()); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          maxLength={30}
          autoFocus
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="e.g. ravi_sharma"
        />
        <div className={`mt-1 text-xs ${statusColor}`}>{statusText || " "}</div>
        <p className="text-xs text-muted-foreground mt-1">3–30 characters. Letters, numbers, underscores only.</p>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex gap-3">
        <Button className="flex-1" disabled={!canSave} onClick={handleSave}>
          {saving ? "Saving…" : "Continue →"}
        </Button>
        <Button variant="outline" onClick={() => navigate("/setup", { replace: true })}>
          Skip
        </Button>
      </div>
    </div>
  );
}
