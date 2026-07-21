import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { loadActiveSession } from "../session.js";
import { scrollIntoViewMotionSafe } from "../lib/utils.js";
import Icon from "../components/Icon.jsx";
import Modal from "../components/Modal.jsx";
import PageMeta from "../components/PageMeta.jsx";
import OnboardingChecklist from "../components/OnboardingChecklist.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import SideDock from "../components/SideDock.jsx";

// Icon boxes used inside bento tiles
function TileIcon({ color, children }) {
  return (
    <div
      className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]"
      style={{ background: `${color}1a`, border: `1px solid ${color}40`, color }}
    >
      {children}
    </div>
  );
}

// Spark / coach icon
function SparkIcon({ color = "var(--periwinkle)", size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
    </svg>
  );
}

export default function LoggedInHome() {
  const { user } = useAuth();
  const hasActive = Boolean(loadActiveSession());
  const greetName = user?.name || user?.username || "there";
  const [showAimHigh, setShowAimHigh] = useState(false);
  const bentoRef = useRef(null);

  useEffect(() => {
    const storageKey = `graspr:last-home-bento-autoscroll:v2:${user?.id || user?.email || user?.username || "anon"}`;
    const thirtyMinutes = 30 * 60 * 1000;
    const now = Date.now();

    try {
      const last = Number(window.localStorage.getItem(storageKey) || 0);
      if (now - last < thirtyMinutes) return;
    } catch {
      // If localStorage is unavailable, still allow the first in-memory mount
      // to scroll; this is a non-critical polish feature.
    }

    const timeout = window.setTimeout(() => {
      scrollIntoViewMotionSafe(bentoRef.current, { block: "start" });
      try {
        window.localStorage.setItem(storageKey, String(Date.now()));
      } catch {}
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [user?.email, user?.id, user?.username]);

  return (
    <div>
      <PageMeta
        title="Graspr - Home"
        description="Your Graspr control panel: quick actions, updates, and progress at a glance."
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          marginTop: -72,
          minHeight: "calc(100svh + 72px)",
          background: "#0B0D13",
        }}
      >
        <img
          src="/summit-sunset.jpg"
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "50% 46%",
            opacity: 0.82,
            filter: "saturate(0.85) brightness(1.0)",
            animation: "kenBurns 26s ease-in-out infinite alternate",
          }}
        />
        {/* left-side text darkening */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(11,13,19,0.88) 0%, rgba(11,13,19,0.55) 28%, rgba(11,13,19,0.15) 60%, rgba(11,13,19,0.04) 100%)" }} />
        {/* bottom fade into page background */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(11,13,19,0.55) 78%, #0B0D13 100%)" }} />

        <div
          className="z-10 mx-auto max-w-[1180px] px-6 pb-0 pt-[150px]"
          style={{
            position: "absolute",
            bottom: "clamp(130px, 16svh, 190px)",
            left: 0,
            right: 0,
          }}
        >
          <h1
            className="display leading-[1.04] max-w-[700px]"
            style={{ fontSize: "clamp(40px, 6vw, 76px)", animation: "fadeSlideUp 0.8s cubic-bezier(.2,.8,.2,1) both" }}
          >
            Welcome back,{" "}
            <em style={{ color: "var(--teal)" }}>{greetName}</em>.
          </h1>
          <p
            className="mt-5 max-w-[480px] text-[18px] leading-relaxed muted"
            style={{ animation: "fadeSlideUp 0.8s ease both", animationDelay: "0.14s" }}
          >
            Pick up where you left off, or jump into something new.
          </p>
        </div>
      </section>

      {/* ── Bento grid ───────────────────────────────────────────────────── */}
      <section ref={bentoRef} className="mx-auto max-w-[1180px] px-6 pb-6" style={{ scrollMarginTop: 96 }}>
        {/* Continue session banner (only when active) */}
        {hasActive && (
          <Link
            to="/practice"
            className="mb-4 flex items-center gap-3 rounded-[14px] px-5 py-3.5 transition-opacity hover:opacity-90"
            style={{
              display: "flex", marginBottom: 16,
              background: "rgba(93,202,165,0.10)", border: "1px solid rgba(93,202,165,0.3)",
            }}
          >
            <Icon name="arrowR" size={16} style={{ color: "var(--teal)", flexShrink: 0 }} />
            <span className="text-[14px] font-semibold" style={{ color: "var(--teal)" }}>
              Continue session
            </span>
            <span className="text-[13px] muted">Pick up your in-progress Drills session →</span>
          </Link>
        )}

        <div className="bento-grid">
          {/* ── Hero tile: Aim High ── */}
          <button
            type="button"
            onClick={() => setShowAimHigh(true)}
            className="bento-hero relative overflow-hidden rounded-[18px] text-left cursor-pointer"
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.4)", transition: "transform .25s ease" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <img
              src="/summit-sunset.jpg"
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "50% 46%",
                filter: "saturate(0.85) brightness(0.95)",
              }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(11,13,19,0.1) 0%, rgba(11,13,19,0.5) 55%, rgba(11,13,19,0.92) 100%)" }} />
            <div className="absolute inset-0 flex flex-col justify-end p-9">
              <div className="eyebrow" style={{ color: "var(--teal)", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                Aim High
              </div>
              <div
                className="display mt-3 max-w-[420px] leading-[1.1]"
                style={{ fontSize: "clamp(22px, 3vw, 38px)", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}
              >
                Climb toward the{" "}
                <em style={{ color: "#8FE3C6" }}>99th percentile</em>.
              </div>
              <div className="mt-3 max-w-[380px] text-[14px]" style={{ color: "#C6CCDA", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                Every drill and debrief is one more step up the mountain.
              </div>
            </div>
          </button>

          {/* ── Coach tile ── */}
          <Link
            to="/coach"
            className="bento-coach relative overflow-hidden rounded-[18px] p-5"
            style={{
              background: "rgba(139,157,255,0.09)", border: "1px solid rgba(139,157,255,0.3)",
              transition: "transform .25s ease",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <div className="relative flex items-center gap-3">
              <SparkIcon />
              <span className="text-[15px] font-semibold">Start Coach</span>
            </div>
            <p className="relative mt-2 text-[12.5px] muted">Full passage, reading map, 1-on-1 AI coaching.</p>
          </Link>

          {/* ── Drills tile ── */}
          <Link
            to="/setup"
            className="bento-dash relative overflow-hidden rounded-[18px] p-5"
            style={{
              background: "var(--surface)", border: "1px solid var(--border-subtle)",
              transition: "transform .25s ease, border-color .25s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(93,202,165,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
          >
            <div className="relative flex items-center gap-3">
              <TileIcon color="var(--teal)">
                <Icon name="pencil" size={17} stroke={1.6} />
              </TileIcon>
              <span className="text-[15px] font-semibold">Start Drills</span>
            </div>
            <p className="relative mt-2 text-[12.5px] muted">Short paragraph, one question, fast reps.</p>
          </Link>

          {/* ── My Plan ── */}
          <Link
            to="/my-plan"
            className="bento-sm1 relative overflow-hidden rounded-[18px] p-5"
            style={{
              background: "var(--surface)", border: "1px solid var(--border-subtle)",
              transition: "transform .25s ease, border-color .25s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(240,168,104,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
          >
            <div className="flex items-center gap-3">
              <TileIcon color="var(--amber)">
                <Icon name="flame" size={17} stroke={1.6} />
              </TileIcon>
              <span className="text-[15px] font-semibold">My Plan</span>
            </div>
            <p className="mt-2 text-[12.5px] muted">Current tier, usage, and purchase history.</p>
          </Link>

          {/* ── Go to Profile ── */}
          <Link
            to="/profile"
            className="bento-sm2 relative overflow-hidden rounded-[18px] p-5"
            style={{
              background: "var(--surface)", border: "1px solid var(--border-subtle)",
              transition: "transform .25s ease, border-color .25s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(93,202,165,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
          >
            <div className="flex items-center gap-3">
              <TileIcon color="var(--green)">
                <Icon name="eye" size={17} stroke={1.6} />
              </TileIcon>
              <span className="text-[15px] font-semibold">Go to Profile</span>
            </div>
            <p className="mt-2 text-[12.5px] muted">Your account, stats, and preferences.</p>
          </Link>

          {/* ── Dashboard tile ── */}
          <Link
            to="/dashboard"
            className="bento-sm3 relative overflow-hidden rounded-[18px] p-5"
            style={{
              background: "var(--surface)", border: "1px solid var(--border-subtle)",
              transition: "transform .25s ease, border-color .25s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = "rgba(240,168,104,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
          >
            <div className="flex items-center gap-3">
              <TileIcon color="var(--amber)">
                <Icon name="target" size={17} stroke={1.6} />
              </TileIcon>
              <span className="text-[15px] font-semibold">Go to Dashboard</span>
            </div>
            <p className="mt-2 text-[12.5px] muted">Accuracy trends, weak areas, trap patterns.</p>
          </Link>
        </div>
      </section>

      {/* ── Onboarding checklist ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1180px] px-6 pb-6">
        <OnboardingChecklist />
      </section>

      {/* ── Scroll-locked right dock: Updates + Blog ─────────────────────── */}
      <SideDock />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="mt-10">
        <SiteFooter />
      </div>

      {/* ── Aim High modal ───────────────────────────────────────────────── */}
      {showAimHigh && (
        <Modal onClose={() => setShowAimHigh(false)} labelledBy="aim-high-dlg">
          <div
            className="relative overflow-hidden rounded-[22px]"
            style={{ width: "min(820px, 94vw)", aspectRatio: "16/9", animation: "fadeSlideUp 0.35s ease both" }}
          >
            <img
              src="/summit-sunset.jpg"
              alt=""
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", objectPosition: "50% 46%",
                filter: "saturate(0.9) brightness(0.95)",
              }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(11,13,19,0.55) 48%, rgba(11,13,19,0.96) 100%)" }} />
            <div className="absolute inset-0 flex flex-col justify-end p-10 md:p-14">
              <div className="eyebrow mb-3" style={{ color: "var(--teal)", textShadow: "0 1px 8px rgba(0,0,0,0.7)" }}>Aim High</div>
              <h2
                id="aim-high-dlg"
                className="display leading-[1.06] max-w-[560px]"
                style={{ fontSize: "clamp(26px, 4.5vw, 52px)", textShadow: "0 2px 20px rgba(0,0,0,0.7)" }}
              >
                Climb toward the{" "}
                <em style={{ color: "#8FE3C6" }}>99th percentile</em>.
              </h2>
              <p className="mt-4 max-w-[460px] text-[15px] leading-relaxed" style={{ color: "#C0C7D8", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                Every Drill sharpens your ability to spot traps and extract the right inference. The more you practice, the more instinctive it becomes.
              </p>
              <div className="mt-7 flex gap-3">
                <Link
                  to="/setup"
                  className="btn btn-primary fx-sheen"
                  style={{ fontSize: 15, padding: "11px 26px" }}
                >
                  Start Drills
                </Link>
                <button
                  type="button"
                  onClick={() => setShowAimHigh(false)}
                  className="btn btn-glass fx-ring"
                  style={{ fontSize: 14 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
