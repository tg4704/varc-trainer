import { useEffect, useState } from "react";
import { useAuth } from "../auth.jsx";
import { getDashboard, changeName, checkUsernameAvailable, changeUsername } from "../api.js";

// Change Password / Log out / Reset all data live in the TopNav avatar
// dropdown now, not here — see TopNav.jsx.
export default function Profile() {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

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

