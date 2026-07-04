import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { getDashboard, changePassword, changeName, resetAccount, checkUsernameAvailable, changeUsername } from "../api.js";
import { clearActiveSession } from "../session.js";

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const joined = user?.createdAt ? (() => { const d = new Date(user.createdAt); return isNaN(d) ? "—" : d.toLocaleDateString(); })() : "—";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="display text-[34px] leading-none">Profile</h1>

      <div className="glass mt-6 p-6">
        <NameRow name={user?.name} onUpdate={updateUser} />
        <UsernameRow username={user?.username} onUpdate={updateUser} />
        <Row label="Email" value={user?.email} />
        <Row label="Joined" value={joined} last />
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Answered" value={stats.answeredCount} />
          <Stat label="Correct" value={stats.correctCount} />
          <Stat label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
        </div>
      )}

      <ChangePassword />

      <div className="mt-8 flex gap-3">
        <button onClick={handleLogout} className="btn btn-glass fx-ring">
          Log out
        </button>
        <ResetData onReset={() => setStats(null)} />
      </div>
    </div>
  );
}

function NameRow({ name, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    if (saving) return;
    setSaving(true); setErr(null);
    try {
      const { user } = await changeName(value.trim());
      onUpdate(user);
      setEditing(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  if (!editing) {
    return (
      <div className="flex justify-between items-center py-2.5" style={{ borderBottom: "1px solid var(--glass-border-lo)" }}>
        <span className="text-sm muted">Name</span>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {name || <span className="dim italic">Not set</span>}
          <button onClick={() => { setValue(name || ""); setEditing(true); }} className="fx-underline text-xs" style={{ color: "var(--teal)" }}>
            Edit
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="py-2.5" style={{ borderBottom: "1px solid var(--glass-border-lo)" }}>
      <span className="text-sm muted block mb-1">Name</span>
      <div className="flex gap-2 items-center">
        <input
          autoFocus
          value={value}
          maxLength={60}
          onChange={(e) => { setValue(e.target.value); setErr(null); }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="e.g. Tarun Mehta"
          className="input flex-1"
          style={{ padding: "8px 12px", fontSize: 13.5 }}
        />
        <button onClick={save} disabled={saving} className="btn btn-primary fx-sheen" style={{ padding: "8px 12px", fontSize: 12 }}>
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs muted hover:text-foreground">Cancel</button>
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

const USERNAME_RE = /^[a-z0-9_]+$/i;

function UsernameRow({ username, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username || "");
  const [available, setAvailable] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!editing || value === username) { setAvailable(null); return; }
    if (value.length < 3 || !USERNAME_RE.test(value)) { setAvailable(false); return; }
    const t = setTimeout(async () => {
      setChecking(true);
      try { const { available: ok } = await checkUsernameAvailable(value); setAvailable(ok); }
      catch { setAvailable(null); }
      finally { setChecking(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [value, username, editing]);

  async function save() {
    if (!value || available === false || saving) return;
    setSaving(true); setErr(null);
    try {
      const { user } = await changeUsername(value);
      onUpdate(user);
      setEditing(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const statusText = checking ? "Checking…" : available === true ? "Available ✓" : available === false ? "Not available" : "";
  const statusColor = available === true ? "var(--green)" : "var(--red)";

  if (!editing) {
    return (
      <div className="flex justify-between items-center py-2.5" style={{ borderBottom: "1px solid var(--glass-border-lo)" }}>
        <span className="text-sm muted">Username</span>
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {username}
          <button onClick={() => { setValue(username); setEditing(true); setAvailable(null); }} className="fx-underline text-xs" style={{ color: "var(--teal)" }}>
            Edit
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className="py-2.5" style={{ borderBottom: "1px solid var(--glass-border-lo)" }}>
      <span className="text-sm muted block mb-1">Username</span>
      <div className="flex gap-2 items-center">
        <input
          autoFocus
          value={value}
          maxLength={30}
          onChange={(e) => { setValue(e.target.value.trim()); setErr(null); }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="input flex-1"
          style={{ padding: "8px 12px", fontSize: 13.5 }}
        />
        <button onClick={save} disabled={!value || available === false || saving || checking} className="btn btn-primary fx-sheen" style={{ padding: "8px 12px", fontSize: 12 }}>
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs muted hover:text-foreground">Cancel</button>
      </div>
      {statusText && <p className="mt-1 text-xs" style={{ color: statusColor }}>{statusText}</p>}
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}

function Row({ label, value, last = false }) {
  return (
    <div className="flex justify-between py-2.5" style={last ? undefined : { borderBottom: "1px solid var(--glass-border-lo)" }}>
      <span className="text-sm muted">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="glass glasscard p-4 text-center">
      <div className="mono text-xl leading-none text-foreground">{value}</div>
      <div className="mt-2 text-xs muted">{label}</div>
    </div>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setMsg("Password updated.");
      setCurrent("");
      setNext("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="fx-underline mt-6 text-sm font-semibold" style={{ color: "var(--teal)" }}>
        Change password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass mt-6 p-6 space-y-3">
      <h2 className="font-semibold text-foreground">Change password</h2>
      <input
        type="password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        className="input"
        required
      />
      <input
        type="password"
        placeholder="New password (min 6 chars)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        minLength={6}
        className="input"
        required
      />
      {err && <p className="text-sm text-destructive">{err}</p>}
      {msg && <p className="text-sm" style={{ color: "var(--green)" }}>{msg}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary fx-sheen">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-glass fx-ring">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ResetData({ onReset }) {
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleReset() {
    setBusy(true);
    try {
      await resetAccount();
      clearActiveSession();
      onReset();
      setShowDialog(false);
      setToast({ type: "success", msg: "All practice data has been reset." });
    } catch (e) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="btn fx-ring"
        style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", color: "var(--red)" }}
      >
        Reset all data
      </button>

      {/* Confirmation dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="glass-floating w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-foreground">Reset all practice data?</h2>
            <p className="mt-2 text-sm muted">
              This will permanently delete all your sessions, attempts, and stats. Your account
              will remain active. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReset}
                disabled={busy}
                className="btn flex-1 disabled:opacity-60"
                style={{ background: "var(--red)", color: "#fff" }}
              >
                {busy ? "Resetting…" : "Yes, reset everything"}
              </button>
              <button onClick={() => setShowDialog(false)} disabled={busy} className="btn btn-glass fx-ring flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className="glass-floating fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-5 py-3 text-sm font-medium"
          style={{ color: toast.type === "success" ? "var(--teal)" : "var(--red)" }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}
