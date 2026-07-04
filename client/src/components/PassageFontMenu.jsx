// "Aa" dropdown for the passage panel: typeface / text size / line spacing,
// plus an annotation count + "Clear all" footer once the reader has made any
// highlight/underline/note annotations. Preferences persist to localStorage
// (see Practice.jsx) so they carry across sessions.
import { useEffect, useRef, useState } from "react";

export const PASSAGE_FONTS = [
  { id: "newsreader", label: "Newsreader", family: "'Newsreader', serif" },
  { id: "lora", label: "Lora", family: "'Lora', serif" },
  { id: "spectral", label: "Spectral", family: "'Spectral', serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible", family: "'Atkinson Hyperlegible', sans-serif" },
  { id: "instrument", label: "Instrument Sans", family: "'Instrument Sans', sans-serif" },
];

export const LINE_SPACINGS = [
  { id: "compact", label: "Compact", value: 1.5 },
  { id: "normal", label: "Normal", value: 1.78 },
  { id: "relaxed", label: "Relaxed", value: 2.05 },
];

export default function PassageFontMenu({
  fontId, onFontChange, fontSize, onFontSizeChange, spacingId, onSpacingChange,
  annotationCount = 0, onClearAnnotations,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-[3px] rounded-[9px] px-[11px] py-[6px] transition-colors"
        style={{ border: "1px solid rgba(255,255,255,0.12)", color: "var(--text)", background: open ? "rgba(255,255,255,0.06)" : "transparent" }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>A</span>
        <span style={{ fontSize: 10, lineHeight: 1 }}>a</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[252px] rounded-[16px] p-4"
          style={{
            background: "rgba(20,23,31,0.92)",
            backdropFilter: "blur(20px) saturate(150%)",
            WebkitBackdropFilter: "blur(20px) saturate(150%)",
            border: "1px solid var(--glass-border-hi)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          }}
        >
          <div className="mono mb-2.5 text-[9.5px] uppercase tracking-wide dim">Typeface</div>
          <div className="flex flex-col gap-1">
            {PASSAGE_FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFontChange(f.id)}
                className="flex items-center justify-between rounded-[9px] px-2.5 py-2 text-left transition-colors"
                style={
                  fontId === f.id
                    ? { background: "rgba(93,202,165,0.1)", border: "1px solid rgba(93,202,165,0.4)" }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--glass-border-lo)" }
                }
              >
                <span style={{ fontFamily: f.family, fontSize: 14, color: "var(--text)" }}>{f.label}</span>
                {fontId === f.id && <span style={{ color: "var(--teal)" }}>✓</span>}
              </button>
            ))}
          </div>

          <div className="mono mb-2.5 mt-4 text-[9.5px] uppercase tracking-wide dim">Text size</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.max(14, fontSize - 1))}
              className="flex h-8 flex-1 items-center justify-center rounded-[9px] text-sm font-semibold"
              style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "var(--text)" }}
            >
              A−
            </button>
            <span className="mono w-8 text-center text-xs dim">{fontSize}</span>
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
              className="flex h-8 flex-1 items-center justify-center rounded-[9px] text-sm font-semibold"
              style={{ border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "var(--text)" }}
            >
              A+
            </button>
          </div>

          <div className="mono mb-2.5 mt-4 text-[9.5px] uppercase tracking-wide dim">Line spacing</div>
          <div className="flex gap-1.5">
            {LINE_SPACINGS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSpacingChange(s.id)}
                className="flex-1 rounded-[9px] py-1.5 text-[11.5px] font-semibold transition-colors"
                style={
                  spacingId === s.id
                    ? { background: "var(--teal)", color: "#07130E" }
                    : { background: "rgba(255,255,255,0.05)", color: "var(--text-2)" }
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          {annotationCount > 0 && (
            <div className="mt-3.5 flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-[11.5px] dim">
                {annotationCount} annotation{annotationCount === 1 ? "" : "s"}
              </span>
              <button type="button" onClick={onClearAnnotations} className="fx-underline text-[12px] font-semibold" style={{ color: "#F0907A" }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
