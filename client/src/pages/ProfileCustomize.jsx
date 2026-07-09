// Dedicated profile-picture picker — split out of the main Profile page so
// Profile itself reads as account info + Student Profile, not a grid of
// swatches. Three kinds: solid color (gradient + initial), icon, emoji.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { changeAvatar } from "../api.js";
import { AVATAR_PRESETS, ICON_PRESETS, EMOJI_PRESETS, encodeAvatar, parseAvatar } from "../lib/avatars.js";
import Avatar from "../components/Avatar.jsx";
import Icon from "../components/Icon.jsx";

const TABS = [
  { id: "grad", label: "Colors" },
  { id: "icon", label: "Icons" },
  { id: "emoji", label: "Emoji" },
];

export default function ProfileCustomize() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const current = parseAvatar(user?.avatarId);
  const [tab, setTab] = useState(current.kind);
  const [saving, setSaving] = useState(null); // the candidate avatarId string being saved, or null
  const [iconBg, setIconBg] = useState(current.kind === "icon" ? current.bg : AVATAR_PRESETS[0].id);

  async function pick(avatarId) {
    if (saving) return;
    setSaving(avatarId);
    try {
      const { user: u } = await changeAvatar(avatarId);
      updateUser(u);
    } catch {}
    finally { setSaving(null); }
  }

  const name = user?.name || user?.username;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link to="/profile" className="flex items-center gap-1.5 text-[13px] font-medium mb-6" style={{ color: "var(--text-2)" }}>
        <Icon name="arrowR" size={14} style={{ transform: "rotate(180deg)" }} /> Back to profile
      </Link>

      <h1 className="display text-[30px] leading-none">Customize your picture</h1>
      <p className="mt-2 muted text-sm">Pick a color, an icon, or an emoji, whatever feels like you.</p>

      <div className="glass mt-6 p-6">
        <div className="flex items-center gap-4">
          <Avatar avatarId={user?.avatarId} name={name} size={64} />
          <div>
            <div className="text-sm font-semibold text-foreground">{name}</div>
            <div className="text-xs dim">This is how you'll appear across Graspr.</div>
          </div>
        </div>

        <div className="mt-6 inline-flex gap-1 rounded-[11px] p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="rounded-[8px] px-4 py-1.5 text-sm font-semibold transition-colors"
              style={tab === t.id ? { background: "var(--teal)", color: "#07130E" } : { color: "var(--text-2)" }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "grad" && (
          <div className="mt-5 flex flex-wrap gap-2.5">
            {AVATAR_PRESETS.map((a) => {
              const id = encodeAvatar("grad", a.id);
              const active = current.kind === "grad" && current.value === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pick(id)}
                  disabled={!!saving}
                  className="fx-ring flex h-12 w-12 items-center justify-center rounded-[13px] text-sm font-bold transition-transform hover:scale-[1.06] disabled:opacity-60"
                  style={{ background: a.gradient, color: "#07130E", boxShadow: active ? "0 0 0 2.5px var(--bg), 0 0 0 4.5px var(--teal)" : "none" }}
                >
                  {(name || "?").charAt(0).toUpperCase()}
                </button>
              );
            })}
          </div>
        )}

        {tab === "icon" && (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {AVATAR_PRESETS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setIconBg(a.id)}
                  className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                  style={{ background: a.gradient, boxShadow: iconBg === a.id ? "0 0 0 2px var(--bg), 0 0 0 3.5px var(--teal)" : "none" }}
                  aria-label={`Background: ${a.id}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {ICON_PRESETS.map((iconName) => {
                const id = encodeAvatar("icon", iconName, iconBg);
                const active = current.kind === "icon" && current.value === iconName && current.bg === iconBg;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => pick(id)}
                    disabled={!!saving}
                    className="fx-ring flex h-12 w-12 items-center justify-center rounded-[13px] transition-transform hover:scale-[1.06] disabled:opacity-60"
                    style={{ background: AVATAR_PRESETS.find((a) => a.id === iconBg)?.gradient, boxShadow: active ? "0 0 0 2.5px var(--bg), 0 0 0 4.5px var(--teal)" : "none" }}
                  >
                    <Icon name={iconName} size={20} style={{ color: "#07130E" }} stroke={2} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === "emoji" && (
          <div className="mt-5 flex flex-wrap gap-2">
            {EMOJI_PRESETS.map((emoji) => {
              const id = encodeAvatar("emoji", emoji);
              const active = current.kind === "emoji" && current.value === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => pick(id)}
                  disabled={!!saving}
                  className="fx-ring flex h-12 w-12 items-center justify-center rounded-[13px] text-xl transition-transform hover:scale-[1.06] disabled:opacity-60"
                  style={{ background: "rgba(255,255,255,0.05)", boxShadow: active ? "0 0 0 2.5px var(--bg), 0 0 0 4.5px var(--teal)" : "none" }}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={() => navigate("/profile")} className="btn btn-primary fx-sheen mt-6 w-full">
        Done
      </button>
    </div>
  );
}
