import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { getDashboard, changeName, checkUsernameAvailable, changeUsername, updateStudentProfile } from "../api.js";
import Avatar from "../components/Avatar.jsx";
import Icon from "../components/Icon.jsx";
import SideDock from "../components/SideDock.jsx";
import { AUTH, PROFILE } from "../lib/limits.js";

const TOPICS = ["economics", "history", "humanities", "philosophy", "science", "social"];
const TOPIC_LABELS = { economics: "Economics", humanities: "Humanities", history: "History", philosophy: "Philosophy", science: "Science", social: "Social" };
const BIO_WORD_LIMIT = PROFILE.BIO_WORD_LIMIT;

function catCountdown(year) {
  const lastNovDay = new Date(Date.UTC(year, 11, 0));
  const catDate = new Date(lastNovDay);
  catDate.setUTCDate(lastNovDay.getUTCDate() - lastNovDay.getUTCDay());
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.ceil((catDate.getTime() - todayUTC) / 86400000);
  return { date: catDate, days };
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    getDashboard().then(setStats).catch(() => setStats(null));
  }, []);

  const joined = user?.createdAt
    ? (() => { const d = new Date(user.createdAt); return isNaN(d) ? "-" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); })()
    : "-";
  const cat = catCountdown(2026);
  const name = user?.name || user?.username;
  const accuracy = stats ? Math.round(stats.accuracy * 100) : null;

  // Progress bar: % of year elapsed from Jan 1 toward the CAT date
  const catBarPct = (() => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const today = new Date();
    const total = cat.date - start;
    return Math.max(0, Math.min(100, ((today - start) / total) * 100));
  })();

  return (
    <div className="mx-auto max-w-[1080px] px-6 pb-16 pt-14">
      <SideDock />
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="display text-[34px] leading-none">Profile</h1>
        <button onClick={() => setEditMode((v) => !v)} className="btn btn-glass fx-ring flex-none">
          {editMode ? "Done" : "Edit profile"}
        </button>
      </div>

      {/* 2-col grid */}
      <div className="profile-grid mt-8">
        {/* ── Left: Identity card ── */}
        <div
          className="relative overflow-hidden rounded-[20px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            padding: "34px 30px",
            animation: "fadeSlideUp 0.7s ease both",
          }}
        >
          {/* Avatar */}
          <div className="relative" style={{ width: 104, height: 104 }}>
            <div
              className="rounded-full"
              style={{
                width: "100%", height: "100%",
                background: "linear-gradient(140deg, var(--teal), var(--periwinkle))",
                padding: 4, boxSizing: "border-box",
                animation: "softPulseTeal 3.4s ease-in-out infinite",
              }}
            >
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
                <Avatar avatarId={user?.avatarId} name={name} size={96} radius={96} />
              </div>
            </div>
            {editMode && (
              <Link
                to="/profile/customize"
                title="Change picture"
                className="fx-ring absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: "var(--teal)", color: "#07130E", border: "2px solid var(--bg)" }}
              >
                ✎
              </Link>
            )}
          </div>

          {/* Name / username */}
          {editMode ? (
            <div className="mt-5">
              <NameRow name={user?.name} onUpdate={updateUser} />
              <UsernameRow username={user?.username} onUpdate={updateUser} />
            </div>
          ) : (
            <>
              <div className="display mt-6 italic leading-none" style={{ fontSize: 38 }}>{name}</div>
              <div className="mono mt-2" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>@{user?.username}</div>
            </>
          )}

          {/* Email + joined */}
          <div className="mt-1.5 text-[11.5px] dim">
            {user?.email} · Joined {joined}
          </div>

          {/* Bio */}
          <div className="mt-5" style={{ borderTop: "1px solid var(--glass-border-lo)", paddingTop: 20 }}>
            {editMode ? (
              <BioRow bio={user?.bio} onUpdate={updateUser} />
            ) : user?.bio ? (
              <div style={{ borderLeft: "2px solid rgba(139,157,255,0.35)", paddingLeft: 16 }}>
                <p className="display italic leading-[1.55]" style={{ fontSize: 17, color: "var(--text)" }}>
                  {user.bio}
                </p>
              </div>
            ) : (
              <p className="text-sm dim italic">No bio yet.</p>
            )}
          </div>

          {/* Favorite topic */}
          <div className="mt-5">
            {editMode ? (
              <FavoriteTopicRow favoriteTopic={user?.favoriteTopic} onUpdate={updateUser} />
            ) : user?.favoriteTopic ? (
              <span
                className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold"
                style={{ background: "rgba(93,202,165,0.14)", border: "1px solid rgba(93,202,165,0.45)", color: "var(--teal)", display: "inline-block" }}
              >
                Favorite Topic - {TOPIC_LABELS[user.favoriteTopic]}
              </span>
            ) : null}
          </div>
        </div>

        {/* ── Right: Performance + countdown ── */}
        <div className="flex flex-col gap-5" style={{ animation: "fadeSlideUp 0.7s ease both", animationDelay: "0.12s" }}>
          {/* Performance card */}
          <div
            className="relative overflow-hidden flex flex-col justify-center rounded-[20px]"
            style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", padding: "32px" }}
          >
            <div className="eyebrow text-center">Performance</div>

            {stats ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-10">
                {/* Jumbo accuracy */}
                <div className="text-center">
                  <div className="mono font-semibold leading-[0.82]" style={{ fontSize: 100, color: "var(--teal)" }}>
                    {accuracy}<span style={{ fontSize: 40 }}>%</span>
                  </div>
                  <div className="mt-3 text-[12px] uppercase tracking-[0.1em] muted">Accuracy</div>
                </div>

                {/* Answered + Correct */}
                <div className="flex flex-col gap-6">
                  <MetricRow
                    icon={<Icon name="pencil" size={17} stroke={1.6} />}
                    color="var(--teal)"
                    value={stats.answeredCount}
                    label="Answered"
                  />
                  <MetricRow
                    icon={
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                        <path d="M5 12.5l4.5 4.5L19 7" />
                      </svg>
                    }
                    color="var(--green)"
                    value={stats.correctCount}
                    label="Correct"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 text-center text-sm muted">Loading stats…</div>
            )}
          </div>

          {/* CAT countdown */}
          <div
            className="rounded-[20px]"
            style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)", padding: "24px 28px" }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-sm muted">Days till CAT 2026</span>
              <span>
                <span className="mono text-[22px] font-semibold">{cat.days >= 0 ? cat.days : 0}</span>
                <span className="ml-2 text-[12px] dim">
                  · {cat.date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </span>
            </div>
            <div
              className="relative mt-3.5 h-1 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ background: "linear-gradient(90deg, var(--teal), var(--periwinkle))", width: `${catBarPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ icon, color, value, label }) {
  return (
    <div className="flex items-center gap-3.5">
      <div
        className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px]"
        style={{ background: `${color}1e` }}
      >
        {icon}
      </div>
      <div>
        <div className="mono font-semibold leading-[0.9]" style={{ fontSize: 38, color }}>{value ?? "-"}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.08em] muted">{label}</div>
      </div>
    </div>
  );
}

function FavoriteTopicRow({ favoriteTopic, onUpdate }) {
  const [saving, setSaving] = useState(false);

  async function pick(topic) {
    if (saving) return;
    const next = topic === favoriteTopic ? null : topic;
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
        maxLength={PROFILE.BIO_CHAR_MAX}
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
          maxLength={AUTH.NAME_MAX}
          onChange={(e) => { setValue(e.target.value); setErr(null); }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="e.g. Jane Doe"
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
          minLength={AUTH.USERNAME_MIN}
          maxLength={AUTH.USERNAME_MAX}
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
