// Small shared hover tooltip — used to move option/setting descriptions out
// of always-visible body copy (information fatigue) and into an on-demand
// reveal. Wrap any trigger element; the label shows on hover/focus, and on
// touch via press-and-hold (group-active). max-w keeps it from overflowing
// narrow screens; for content that MUST be readable on touch, prefer showing
// it inline rather than in a tooltip.
export default function Tooltip({ label, children, side = "bottom", wrapperClassName = "" }) {
  if (!label) return children;
  const posClass =
    side === "top"
      ? "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2"
      : side === "left"
      ? "right-[calc(100%+8px)] top-1/2 -translate-y-1/2"
      : "top-[calc(100%+8px)] left-1/2 -translate-x-1/2";

  return (
    <div className={`group relative ${wrapperClassName}`}>
      {children}
      <div
        className={`pointer-events-none absolute z-20 w-max max-w-[min(240px,calc(100vw-24px))] rounded-[10px] px-3 py-2 text-[11.5px] leading-snug opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 ${posClass}`}
        style={{
          background: "rgba(18,20,27,0.96)",
          border: "1px solid var(--glass-border-hi)",
          color: "var(--text-2)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Small circular (i) affordance — use next to a label/heading when there's
// no natural button to hang the tooltip off of.
export function InfoDot({ label, size = 16 }) {
  return (
    <Tooltip label={label}>
      <span
        tabIndex={0}
        className="flex items-center justify-center rounded-full font-serif italic outline-none"
        style={{ width: size, height: size, fontSize: size * 0.62, border: "1px solid rgba(255,255,255,0.22)", color: "var(--text-2)", cursor: "default" }}
      >
        i
      </span>
    </Tooltip>
  );
}
