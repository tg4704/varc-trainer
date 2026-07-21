import { useEffect, useRef } from "react";

// Accepts a ref, a raw element, or a getter function, and returns the element
// (or null). A getter is the useful form when the target only exists later, or
// lives inside a wrapper ref - e.g. () => navRef.current?.querySelector("button").
function resolveFocusTarget(v) {
  if (!v) return null;
  if (typeof v === "function") return v() || null;
  if (typeof v === "object" && "current" in v) return v.current || null;
  return v;
}

// Shared modal shell: backdrop fade-in, dialog semantics, focus trap,
// Esc-to-close, and focus restoration on unmount. Callers provide the panel as
// children (keep the panel's own onClick={e => e.stopPropagation()} so a click
// inside it doesn't close the modal, and add `animate-slide-up` for the panel
// entrance). Reduced-motion is handled globally in index.css.
//
//   <Modal onClose={close} labelledBy="my-title">
//     <div onClick={e => e.stopPropagation()} className="glass-floating … animate-slide-up">…</div>
//   </Modal>
export default function Modal({
  onClose,
  closeOnBackdrop = true,
  backdrop = "bg-black/60",
  labelledBy,
  className = "",
  // "center" (default) centers the panel; "top" top-aligns and lets the whole
  // overlay scroll - use for panels that can be taller than the viewport.
  align = "center",
  // Optional explicit focus-restore target: a ref, an element, or a function
  // returning an element. Needed when whatever opened the modal is unmounted
  // by the very click that opened it - e.g. an item inside a dropdown that
  // closes on select. In that case the activeElement captured below is already
  // detached from the document by the time we try to restore, and .focus() on
  // a detached node silently does nothing, dropping focus to <body>.
  returnFocusTo,
  children,
}) {
  const rootRef = useRef(null);
  const prevFocus = useRef(null);
  // Held in a ref so the unmount cleanup reads the latest value without
  // needing returnFocusTo in the effect's dependency array (which would
  // re-run the effect and re-capture prevFocus mid-life).
  const returnFocusToRef = useRef(returnFocusTo);
  returnFocusToRef.current = returnFocusTo;

  useEffect(() => {
    prevFocus.current = document.activeElement;
    const root = rootRef.current;
    const focusables = () =>
      Array.from(
        root.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((n) => n.offsetParent !== null);

    // Focus the first control (or the dialog itself) on open.
    const initial = focusables();
    (initial[0] || root).focus();

    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (f.length === 0) {
          e.preventDefault();
          return;
        }
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);

      // Restore focus to whatever opened the modal. Prefer the caller's
      // explicit target, fall back to the element that had focus at mount.
      // Both are checked with isConnected: focusing a node that's been removed
      // from the DOM is a silent no-op that strands focus on <body>.
      const explicit = resolveFocusTarget(returnFocusToRef.current);
      const target =
        (explicit?.isConnected ? explicit : null) ||
        (prevFocus.current?.isConnected ? prevFocus.current : null);
      if (typeof target?.focus === "function") target.focus();
    };
  }, [onClose]);

  const alignClasses =
    align === "top"
      ? "items-start justify-center overflow-y-auto py-10"
      : "items-center justify-center";

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onClick={closeOnBackdrop ? onClose : undefined}
      className={`fixed inset-0 z-50 flex px-4 outline-none animate-fade-in ${alignClasses} ${backdrop} ${className}`}
    >
      {children}
    </div>
  );
}
