import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import * as api from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";

export default function CompleteProfile() {
  const { user, loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername]     = useState(user?.username || "");
  const [dateOfBirth, setDob]       = useState("");
  const [error, setError]           = useState(null);
  const [busy, setBusy]             = useState(false);

  // If profile is already complete, skip this page
  useEffect(() => {
    if (user && user.profileComplete !== false) {
      navigate("/setup", { replace: true });
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user: updated } = await api.completeProfile({ username: username.trim(), dateOfBirth: dateOfBirth || undefined });
      loginWithToken(api.getToken(), updated);
      navigate("/setup", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-foreground">Complete your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You're almost in — just confirm your username and optionally add your date of birth.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="block text-sm font-medium text-foreground mb-1">Username</span>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            placeholder="e.g. tarungupta"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Letters, numbers, and underscores only. Min 3 characters.
          </p>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-foreground mb-1">
            Date of birth <span className="text-muted-foreground font-normal">(optional)</span>
          </span>
          <Input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={busy} className="w-full" size="lg">
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
