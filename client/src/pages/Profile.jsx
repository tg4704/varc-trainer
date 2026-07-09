import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { getDashboard, changeName, checkUsernameAvailable, changeUsername, updateStudentProfile } from "../api.js";
import Avatar from "../components/Avatar.jsx";

const TOPICS = ["economics", "humanities", "philosophy", "science", "social"];
const TOPIC_LABELS = { economics: "Economics", humanities: "Humanities", philosophy: "Philosophy", science: "Science", social: "Social" };
const BIO_WORD_LIMIT = 40;

// Last Sunday of November — CAT is traditionally held that week.
function catCountdown(year) {
  const lastNovDay = new Date(Date.UTC(year, 11, 0)); // day 0 of December = Nov 30
  const catDate = new Date(lastNovDay);
  catDate.setUTCDate(lastNovDay.getUTCDate() - lastNovDay.getUTCDay());
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.ceil((catDate.getTime() - todayUTC) / 86400000);
  return { date: catDate, days };
}

// Read-only by default (a page worth looking clean and presentable); "Edit
// profile" flips a single page-level flag that reveals the same inline
// row editors this page has always used (Name/Username/Topic/Bio each
// still manage their own local edit/save state). Danger zone actions
// (Reset data / Delete account) live only in the TopNav avatar dropdown now —
// see TopNav.jsx — so this page stays purely about who-you-are, not
// account destruction.
export default function Profile() {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const joined = user?.createdAt ? (() => { const d = new Date(user.createdAt); return isNaN(d) ? "—" : d.toLocaleDateString(); })() : "—";
  const cat = catCountdown(2026);
  const name = user?.name || user?.username;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-[34px] leading-none">Profile</h1>
        <button onClick={() => setEditMode((v) => !v)} className="btn btn-glass fx-ring flex-none">
          {editMode ? "Done" : "Edit profile"}
        </button>
      </div>

      {/* Header card — read-only identity view by default; Edit mode swaps
          name/username/bio/topic for their inline editors in place. */}
      <div className="glass mt-6 p-7">
        <div className="flex items-start gap-5">
          <div className="relative flex-none">
            <Avatar avatarId={user?.avatarId} name={name} size={76} />
            {editMode && (
              <Link
                to="/profile/customize"
                title="Change picture"
                className="fx-ring absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "var(--teal)", color: "#07130E", border: "2px solid var(--bg)" }}
              >
                ✎
              </Link>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            {editMode ? (
              <div className="-mt-1">
                <NameRow name={user?.name} onUpdate={updateUser} />
                <UsernameRow username={user?.username} onUpdate={updateUser} />
              </div>
            ) : (
              <>
                <div className="display truncate text-[23px] leading-tight text-foreground">{name}</div>
                <div className="mt-0.5 text-sm dim">@{user?.username}</div>
              </>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs dim">
              <span>{user?.email}</span>
              <span>Joined {joined}</span>
            </div>
          </div>
        </div>

        {editMode ? (
          <div className="mt-4">
            <BioRow bio={user?.bio} onUpdate={updateUser} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-foreground">
            {user?.bio || <span className="dim italic">No bio yet.</span>}
          </p>
        )}

        {editMode ? (
          <div className="mt-1">
            <FavoriteTopicRow favoriteTopic={user?.favoriteTopic} onUpdate={updateUser} />
          </div>
        ) : (
          user?.favoriteTopic && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "rgba(93,202,165,0.14)", border: "1px solid rgba(93,202,165,0.45)", color: "var(--teal)" }}
              >
                {TOPIC_LABELS[user.favoriteTopic]} enthusiast
              </span>
            </div>
          )
        )}
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Answered" value={stats.answeredCount} />
          <Stat label="Correct" value={stats.correctCount} />
          <Stat label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
        </div>
      )}

      <div className="glass mt-6 flex items-center justify-between p-6">
        <span className="text-sm muted">Days till CAT 2026</span>
        <span className="text-right">
          <span className="mono text-sm font-semibold text-foreground">{cat.days >= 0 ? cat.days : 0}</span>
          <span className="ml-1.5 text-xs dim">({cat.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})</span>
        </span>
      </div>
    </div>
  );
}

function FavoriteTopicRow({ favoriteTopic, onUpdate }) {
  const [saving, setSaving] = useState(false);

  async function pick(topic) {
    if (saving) return;
    const next = topic === favoriteTopic ? null : topic; // click again to clear
    setSaving(true);
    try {
      const { user } = await updateStudentProfile({ favoriteTopic: next });
      onUpdate(user);
    } catch {}
    finally { setSaving(false); }
  }

  return (
    <div className="py-2.5">
      <span className="text-sm muted block mb-2">Favorite RC topic</span>
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((t) => {
          const active = favoriteTopic === t;
          return (
            <button
              key={t}
              type="button"
              disabled={saving}
              onClick={() => pick(t)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60"
              style={active
                ? { background: "rgba(93,202,165,0.14)", border: "1px solid rgba(93,202,165,0.45)", color: "var(--teal)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)", color: "var(--text-2)" }}
            >
              {TOPIC_LABELS[t]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BioRow({ bio, onUpdate }) {
  const [value, setValue] = useState(bio || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > BIO_WORD_LIMIT;

  async function save() {
    if (saving || overLimit || value.trim() === (bio || "")) return;
    setSaving(true); setErr(null);
    try {
      const { user } = await updateStudentProfile({ bio: value.trim() });
      onUpdate(user);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <span className="text-sm muted block mb-1">Bio <span className="dim font-normal">(max {BIO_WORD_LIMIT} words)</span></span>
      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); setErr(null); }}
        onBlur={save}
        rows={2}
        className="input"
        style={{ resize: "vertical" }}
        placeholder="A line about how you're prepping, what you're aiming for…"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs" style={{ color: overLimit ? "var(--red)" : "var(--text-2)" }}>{wordCount} / {BIO_WORD_LIMIT} words</span>
        {saving && <span className="text-xs dim">Saving…</span>}
      </div>
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
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
      <div className="flex items-center gap-2 py-1">
        <span className="display text-[20px] leading-tight text-foreground">
          {name || <span className="dim italic">Not set</span>}
        </span>
        <button onClick={() => { setValue(name || ""); setEditing(true); }} className="fx-underline text-xs" style={{ color: "var(--teal)" }}>
          Edit
        </button>
      </div>
    );
  }
  return (
    <div className="py-1">
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
        <button onClick={save} disabled={saving} className="btn btn-primary fx-sheen flex-none" style={{ padding: "8px 12px", fontSize: 12 }}>
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs muted hover:text-foreground flex-none">Cancel</button>
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
      <div className="flex items-center gap-2 py-1">
        <span className="text-sm dim">@{username}</span>
        <button onClick={() => { setValue(username); setEditing(true); setAvailable(null); }} className="fx-underline text-xs" style={{ color: "var(--teal)" }}>
          Edit
        </button>
      </div>
    );
  }
  return (
    <div className="py-1">
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
        <button onClick={save} disabled={!value || available === false || saving || checking} className="btn btn-primary fx-sheen flex-none" style={{ padding: "8px 12px", fontSize: 12 }}>
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs muted hover:text-foreground flex-none">Cancel</button>
      </div>
      {statusText && <p className="mt-1 text-xs" style={{ color: statusColor }}>{statusText}</p>}
      {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
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
