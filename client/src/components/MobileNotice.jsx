import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { Button } from "./ui/button.jsx";

const DISMISS_KEY = "graspr_mobile_notice_dismissed";

// Phone-sized AND touch. The pointer:coarse half matters: without it, a laptop
// user with a narrow browser window gets told to "switch to a laptop", which
// reads as broken. 1024px matches the breakpoint where TopNav collapses, so
// this fires on exactly the widths the layout is already compromising at.
const QUERY = "(max-width: 1023px) and (pointer: coarse)";

// One-time "this works better on a bigger screen" notice. Deliberately
// advisory, not a wall — the app does function on a phone, it's just cramped
// (side-by-side passage/question layouts, the Drills reasoning textarea, the
// admin tables), and blocking a curious visitor on the device they happen to
// be holding would cost more than the bad first impression it avoids.
export default function MobileNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Private mode / storage blocked. Showing the notice once per page load
      // is the safe direction here — it's dismissible either way.
    }
    if (dismissed) return;
    // Evaluated once on mount rather than subscribed to: a notice that pops up
    // mid-session because the on-screen keyboard changed the viewport height,
    // or because the user rotated the phone, would be worse than not showing.
    if (window.matchMedia?.(QUERY).matches) setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Non-fatal: worst case they see it again next visit.
    }
    setShow(false);
  };

  return (
    <Modal onClose={dismiss} labelledBy="mobile-notice-title">
      <div
        className="glass-floating w-full max-w-sm p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="mobile-notice-title" className="display text-[22px]">
          Better on a bigger screen
        </h2>
        <p className="mt-2 text-sm leading-relaxed muted">
          Graspr is built for laptops and desktops. Reading passages, writing out
          your reasoning, and reviewing feedback side by side all need more room
          than a phone gives — some screens will feel cramped here.
        </p>
        <p className="mt-2 text-sm leading-relaxed muted">
          You're welcome to look around, but do your actual practice on a bigger
          screen.
        </p>
        <div className="mt-6">
          <Button className="fx-sheen w-full" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
