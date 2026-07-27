// Custom listbox replacing native <select>.
//
// Why: a native <select> lets us style the closed box, but the popup list is
// drawn by the OS. On Windows that means an opaque white menu with black text
// on every screen of an otherwise dark-only app - it looked broken. Chrome's
// newer appearance:base-select isn't broadly available yet, so the only way to
// own that surface is to render it ourselves.
//
// Keeps native keyboard behaviour: ↑/↓ move, Enter/Space select, Esc closes,
// Home/End jump, typing a letter jumps to the first match. The trigger carries
// the ARIA combobox/listbox roles so screen readers still announce it as a
// select.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Normalises both supported shapes: ["a", "b"] or [{ value, label }].
function normalize(options) {
  return (options || []).map((o) =>
    o && typeof o === "object" ? { value: o.value, label: o.label ?? String(o.value) } : { value: o, label: String(o) }
  );
}

export function Select({
  value,
  onChange,          // called with the raw value, not an event
  options,
  placeholder = "Select…",
  className = "",
  disabled = false,
  id,
  "aria-label": ariaLabel,
}) {
  const items = normalize(options);
  const selectedIdx = items.findIndex((o) => String(o.value) === String(value));
  const selected = selectedIdx >= 0 ? items[selectedIdx] : null;

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(selectedIdx >= 0 ? selectedIdx : 0);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeaheadRef = useRef({ buffer: "", at: 0 });

  const measure = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  function openList() {
    if (disabled) return;
    measure();
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  }
  function closeList({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }
  function commit(idx) {
    const item = items[idx];
    if (item) onChange?.(item.value);
    closeList();
  }

  // The list is portaled to <body> so no ancestor's overflow/transform can clip
  // it, which means it doesn't move with the page on its own - track it.
  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onScrollOrResize = () => measure();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, measure]);

  // Close on any click that isn't inside the trigger or the list.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target)) return;
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  // Keep the highlighted row in view when arrowing through a long list.
  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector(`[data-idx="${activeIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  function jumpTo(char) {
    const now = Date.now();
    const t = typeaheadRef.current;
    t.buffer = now - t.at > 800 ? char : t.buffer + char;
    t.at = now;
    const found = items.findIndex((o) => o.label.toLowerCase().startsWith(t.buffer.toLowerCase()));
    if (found >= 0) {
      if (open) setActiveIdx(found);
      else onChange?.(items[found].value);
    }
  }

  function onKeyDown(e) {
    if (disabled) return;
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      jumpTo(e.key);
      e.preventDefault();
      return;
    }
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) commit(activeIdx); else openList();
        break;
      case "Escape":
        if (open) { e.preventDefault(); closeList(); }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActiveIdx((i) => Math.min(items.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActiveIdx((i) => Math.max(0, i - 1));
        break;
      case "Home":
        if (open) { e.preventDefault(); setActiveIdx(0); }
        break;
      case "End":
        if (open) { e.preventDefault(); setActiveIdx(items.length - 1); }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
      default:
        break;
    }
  }

  // Flip above the trigger when there isn't room below.
  const listMaxHeight = 280;
  let listStyle = null;
  if (rect) {
    const below = window.innerHeight - rect.bottom;
    const flip = below < Math.min(listMaxHeight, 180) && rect.top > below;
    listStyle = {
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 90,
      maxHeight: listMaxHeight,
      ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    };
  }

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (open ? closeList({ refocus: false }) : openList())}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={`input flex items-center justify-between gap-2 text-left ${className}`}
        style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
      >
        <span className="truncate" style={{ color: selected ? "var(--text)" : "var(--text-muted)" }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className="flex-none opacity-60 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && listStyle && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          style={{
            ...listStyle,
            overflowY: "auto",
            background: "var(--surface, #14171F)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-default)",
            boxShadow: "0 18px 44px rgba(0,0,0,0.55)",
            padding: 4,
          }}
        >
          {items.length === 0 && (
            <li className="px-3 py-2 text-[13px]" style={{ color: "var(--text-muted)" }}>No options</li>
          )}
          {items.map((o, i) => {
            const isSelected = String(o.value) === String(value);
            const isActive = i === activeIdx;
            return (
              <li
                key={String(o.value)}
                data-idx={i}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => commit(i)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-[13.5px]"
                style={{
                  background: isActive ? "rgba(93,202,165,0.12)" : "transparent",
                  color: isSelected ? "var(--teal)" : "var(--text)",
                }}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </>
  );
}

export default Select;
