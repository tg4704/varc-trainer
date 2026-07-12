// First-session activation checklist — shown on Home for logged-in users
// until both steps are done or the user dismisses it. Verify-email is
// deliberately not a step here: login is already blocked for unverified
// accounts (server/routes/auth.js), so by the time a user can see this at
// all, their email is already verified.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboard, coach } from "../api.js";
import { track } from "../analytics.js";
import Icon from "./Icon.jsx";

const DISMISS_KEY = "graspr_onboarding_dismissed";

export default function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [steps, setSteps] = useState(null); // null = still loading

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    Promise.all([getDashboard().catch(() => null), coach.stats().catch(() => null)]).then(
      ([dash, coachStats]) => {
        if (cancelled) return;
        setSteps({
          drill: Boolean(dash && Number(dash.totalAttempts) > 0),
          coach: Boolean(coachStats && Number(coachStats.totalSessions) > 0),
        });
      }
    );
    return () => { cancelled = true; };
  }, [dismissed]);

  if (dismissed || !steps) return null;
  if (steps.drill && steps.coach) return null; // both done — nothing to nag about

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    track("onboarding_dismissed", steps);
    setDismissed(true);
  }

  const items = [
    { key: "drill", done: steps.drill, label: "Finish your first Drill", to: "/setup" },
    { key: "coach", done: steps.coach, label: "Try AI Coach", to: "/coach" },
  ];

  return (
    <div
      className="mb-7 rounded-[16px] p-5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--glass-border-lo)",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-foreground">Get started</span>
        <button
          onClick={dismiss}
          aria-label="Dismiss checklist"
          className="fx-ring rounded-[6px] p-1 dim transition-colors hover:text-foreground"
        >
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {items.map((it) => (
          <Link
            key={it.key}
            to={it.to}
            className="fx-ring flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 -mx-2 transition-colors hover:bg-white/[0.04]"
          >
            <span
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
              style={
                it.done
                  ? { background: "var(--teal)", color: "#07130E" }
                  : { border: "1.5px solid var(--glass-border-hi)" }
              }
            >
              {it.done && <Icon name="check" size={11} stroke={3} />}
            </span>
            <span className={`text-[13.5px] ${it.done ? "dim line-through" : "text-foreground"}`}>
              {it.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
