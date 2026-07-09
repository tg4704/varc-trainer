// Renders a session-results share card to a PNG Blob, drawn entirely on an
// offscreen canvas — no server round-trip or third-party image service. Used
// by ShareResultsModal for Download / Copy-to-clipboard / native Share sheet.
const W = 1080;
const H = 1080;

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function hexToRgba(hex, alpha) {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function ensureFontsReady() {
  try { await document.fonts.ready; } catch {}
  const specs = [
    'italic 700 128px "Newsreader"',
    '500 40px "Newsreader"',
    '600 34px "Instrument Sans"',
    '500 26px "Instrument Sans"',
    '600 24px "IBM Plex Mono"',
  ];
  await Promise.all(specs.map((s) => document.fonts.load(s).catch(() => {})));
}

// data: { accuracyPct, correct, total, trapPicked, dateLabel, headline, eyebrow, statLabel, displayName }
// `trapPicked` is optional — pass null to render a generic second stat (e.g.
// reasoning score) instead, via `statLabel`/`statValue`. `displayName` is the
// student's name (falls back to their @username) and renders as a byline
// under the date, top-right, mirroring the wordmark/eyebrow stack top-left.
export async function buildResultsShareCard(data) {
  await ensureFontsReady();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = cssVar("--bg", "#0B0D13");
  const teal = cssVar("--teal", "#5DCAA5");
  const text = cssVar("--text", "#F5F6F8");
  const text2 = cssVar("--text-2", "#9AA3B8");

  // Background wash + soft accent glow
  const base = ctx.createRadialGradient(W * 0.5, H * 0.28, 80, W * 0.5, H * 0.5, W * 0.85);
  base.addColorStop(0, "#141821");
  base.addColorStop(1, bg);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 420, 40, W / 2, 420, 340);
  glow.addColorStop(0, hexToRgba(teal, 0.22));
  glow.addColorStop(1, hexToRgba(teal, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Wordmark (top-left) + eyebrow
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = text;
  ctx.font = '600 34px "Instrument Sans"';
  ctx.fillText("graspr", 72, 104);
  const wmWidth = ctx.measureText("graspr").width;
  ctx.fillStyle = teal;
  ctx.fillText(".", 72 + wmWidth, 104);
  ctx.fillStyle = text2;
  ctx.font = '600 22px "IBM Plex Mono"';
  ctx.fillText(data.eyebrow || "DRILLS SESSION", 72, 144);

  // Byline + date (top-right) — mirrors the wordmark/eyebrow stack on the left.
  ctx.textAlign = "right";
  if (data.displayName) {
    ctx.fillStyle = text;
    ctx.font = '600 30px "Instrument Sans"';
    ctx.fillText(data.displayName, W - 72, 104);
  }
  ctx.fillStyle = text2;
  ctx.font = '500 22px "IBM Plex Mono"';
  ctx.fillText(data.dateLabel, W - 72, 144);

  // Accuracy ring
  const cx = W / 2, cy = 428, r = 200;
  ctx.lineWidth = 22;
  ctx.strokeStyle = hexToRgba(text, 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const frac = Math.max(0, Math.min(1, data.accuracyPct / 100));
  ctx.strokeStyle = teal;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.textAlign = "center";
  ctx.fillStyle = text;
  ctx.font = 'italic 700 122px "Newsreader"';
  ctx.fillText(`${data.accuracyPct}%`, cx, cy + 38);
  ctx.font = '600 22px "IBM Plex Mono"';
  ctx.fillStyle = text2;
  ctx.fillText("ACCURACY", cx, cy + 86);

  // Headline
  ctx.font = '500 40px "Newsreader"';
  ctx.fillStyle = text;
  wrapText(ctx, data.headline, cx, 704, 880, 50);

  // Stat chips — second chip defaults to trap rate (Drills) but callers can
  // override with any [value, label] pair (e.g. Coach passes reasoning score).
  const stats = [
    [`${data.correct}/${data.total}`, "CORRECT"],
    data.secondStat || [String(data.trapPicked ?? 0), "TRAPS TAKEN"],
  ];
  const chipW = 320, chipGap = 40, chipY = 810, chipH = 140;
  const totalW = stats.length * chipW + (stats.length - 1) * chipGap;
  let x = cx - totalW / 2;
  for (const [value, label] of stats) {
    roundRect(ctx, x, chipY, chipW, chipH, 24);
    ctx.fillStyle = hexToRgba(text, 0.05);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(text, 0.1);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = text;
    ctx.font = '600 50px "IBM Plex Mono"';
    ctx.fillText(value, x + chipW / 2, chipY + 70);
    ctx.fillStyle = text2;
    ctx.font = '600 20px "IBM Plex Mono"';
    ctx.fillText(label, x + chipW / 2, chipY + 108);
    x += chipW + chipGap;
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = text2;
  ctx.font = '500 26px "Instrument Sans"';
  ctx.fillText("Practice CAT RC trap-recognition at graspr.in", cx, 1000);

  return await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  const lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}
