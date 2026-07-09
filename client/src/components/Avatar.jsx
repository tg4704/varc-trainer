// Renders a user's chosen profile picture — gradient initial, icon, or emoji
// — from the encoded avatar_id string. See lib/avatars.js for the format.
import Icon from "./Icon.jsx";
import { parseAvatar, avatarGradient } from "../lib/avatars.js";

export default function Avatar({ avatarId, name, size = 24, radius }) {
  const a = parseAvatar(avatarId);
  const r = radius ?? Math.max(6, Math.round(size * 0.28));
  const base = { width: size, height: size, borderRadius: r, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };

  if (a.kind === "emoji") {
    return (
      <span style={{ ...base, background: "rgba(255,255,255,0.08)", fontSize: size * 0.58, lineHeight: 1 }}>
        {a.value}
      </span>
    );
  }
  if (a.kind === "icon") {
    return (
      <span style={{ ...base, background: avatarGradient(a.bg) }}>
        <Icon name={a.value} size={size * 0.55} style={{ color: "#07130E" }} stroke={2} />
      </span>
    );
  }
  return (
    <span style={{ ...base, background: avatarGradient(a.value), color: "#07130E", fontWeight: 700, fontSize: size * 0.44 }}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}
