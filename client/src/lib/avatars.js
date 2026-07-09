// Profile-picture presets and encoding. Three kinds, no external images:
//   grad  — a gradient circle + the user's initial (the original/default look)
//   icon  — one of the app's line-art icons (Icon.jsx) on a gradient circle
//   emoji — a single emoji on a neutral circle
// Encoded as a single string stored in users.avatar_id: "kind:value" or, for
// icons, "icon:name:bgGradientId". A bare string with no colon is the legacy
// gradient-only format ("teal") and still parses as kind=grad for old rows.
export const AVATAR_PRESETS = [
  { id: "teal", gradient: "linear-gradient(140deg, #5DCAA5, #8B9DFF)" },
  { id: "periwinkle", gradient: "linear-gradient(140deg, #8B9DFF, #C084FC)" },
  { id: "amber", gradient: "linear-gradient(140deg, #FBBF24, #F87171)" },
  { id: "coral", gradient: "linear-gradient(140deg, #F87171, #F0A868)" },
  { id: "violet", gradient: "linear-gradient(140deg, #C084FC, #5DCAA5)" },
  { id: "sky", gradient: "linear-gradient(140deg, #6FA0E8, #5DCAA5)" },
  { id: "rose", gradient: "linear-gradient(140deg, #F0A868, #C084FC)" },
  { id: "lime", gradient: "linear-gradient(140deg, #5DCAA5, #FBBF24)" },
];
export const AVATAR_IDS = AVATAR_PRESETS.map((a) => a.id);

export function avatarGradient(avatarId) {
  return AVATAR_PRESETS.find((a) => a.id === avatarId)?.gradient || AVATAR_PRESETS[0].gradient;
}

// Icon names must exist in components/Icon.jsx's set.
export const ICON_PRESETS = ["book", "target", "spark", "flame", "send", "link", "flag", "pencil"];

export const EMOJI_PRESETS = [
  "😀", "😎", "🤓", "🧐", "🦉", "🦊", "🐼", "🐨",
  "🦁", "🐯", "🚀", "🎯", "📚", "✏️", "🔥", "⚡",
  "🌟", "🎓", "🧠", "💡", "🌈", "🎨", "🏆", "🐸",
];

export function encodeAvatar(kind, value, bg) {
  if (kind === "grad") return `grad:${value}`;
  if (kind === "icon") return `icon:${value}:${bg || AVATAR_PRESETS[0].id}`;
  if (kind === "emoji") return `emoji:${value}`;
  return AVATAR_PRESETS[0].id;
}

// Returns { kind: 'grad'|'icon'|'emoji', value, bg }
export function parseAvatar(raw) {
  if (!raw) return { kind: "grad", value: AVATAR_PRESETS[0].id };
  if (!raw.includes(":")) return { kind: "grad", value: raw }; // legacy bare-gradient format
  const parts = raw.split(":");
  const kind = parts[0];
  if (kind === "grad") return { kind: "grad", value: parts[1] || AVATAR_PRESETS[0].id };
  if (kind === "icon") return { kind: "icon", value: parts[1], bg: parts[2] || AVATAR_PRESETS[0].id };
  if (kind === "emoji") return { kind: "emoji", value: parts.slice(1).join(":") };
  return { kind: "grad", value: AVATAR_PRESETS[0].id };
}
