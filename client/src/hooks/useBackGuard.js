import { useEffect, useRef } from "react";

// Intercepts the browser's own Back — the toolbar button, Alt/Cmd+←, and the
// two-finger swipe-back gesture that trackpads and touch browsers fire.
//
// Why this exists separately from navGuard and beforeunload:
//   - navGuard.jsx only sees in-app navigation that goes through attemptNav(),
//     i.e. clicks on our own nav. It never sees a Back.
//   - beforeunload only fires on a real document unload (tab close, refresh,
//     leaving the origin). A Back inside a single-page app is a history pop,
//     the document never unloads, so nothing fires and the user is silently
//     yanked out of a live session. That's the swipe-back report.
//
// The mechanism is the standard SPA one: push a throwaway sentinel entry so
// the first Back consumes the sentinel rather than actually leaving. On the
// resulting popstate we immediately re-arm with a fresh sentinel (so a second
// Back is caught too) and hand control to `onBlock`, which shows the page's
// own leave-confirmation modal.
//
// Deliberately no cleanup: removing the sentinel would mean calling
// history.back() during unmount, which — on a legitimate confirmed exit —
// would land the user right back on the page they just chose to leave. A
// leftover sentinel costs at most one extra Back press later, which is the
// far cheaper failure.
export default function useBackGuard(enabled, onBlock) {
  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;

  useEffect(() => {
    if (!enabled) return;
    window.history.pushState({ grasprBackGuard: true }, "");

    function handlePopState() {
      window.history.pushState({ grasprBackGuard: true }, "");
      try { onBlockRef.current?.(); } catch { /* never let a guard break nav */ }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled]);
}
