// Universal top nav — floating glass pill shown on every logged-in,
// non-session page (Home, Dashboard, Coach hub, Drills setup, Profile, My
// Questions, Results, etc). Replaces the old fragmented model (floating pill
// on Home only / glass sidebar on hub pages / plain bar everywhere else)
// with one consistent bar: Practice ▾ (Trainer / AI Coach) · Dashboard ·
// avatar ▾ (Profile / My Questions / Admin / Change Password / Reset all
// data / Log out). Change Password and Reset all data open modals directly
// from here rather than navigating to Profile.
//
// In-session pages (/practice, /coach/practice) get their own minimal
// session bar (Exit / progress / timer) instead of this — see App.jsx.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useNavGuard } from "../navGuard.jsx";
import { BrandMark } from "./AuthShell.jsx";
import Icon from "./Icon.jsx";
import { changePassword, resetAccount } from "../api.js";
import { clearActiveSession } from "../session.js";

export default function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { attemptNav } = useNavGuard();
  const [scrolled, setScrolled] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showResetData, setShowResetData] = useState(false);
  const practiceRef = useRef(null);
  const userRef = useRef(null);
  // The dropdown menus are portaled to <body> so they escape this nav's
  // backdrop-filter — a backdrop-filter nested inside another backdrop-filter
  // renders as a flat translucent panel (no visible blur). Their positions are
  // measured from the trigger buttons on open.
  const practiceMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const [practiceRect, setPracticeRect] = useState(null);
  const [userRect, setUserRect] = useState(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setPracticeOpen(false);
      setUserOpen(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!practiceOpen && !userOpen) return;
    function onDocClick(e) {
      const inPractice = practiceRef.current?.contains(e.target) || practiceMenuRef.current?.contains(e.target);
      const inUser = userRef.current?.contains(e.target) || userMenuRef.current?.contains(e.target);
      if (!inPractice) setPracticeOpen(false);
      if (!inUser) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [practiceOpen, userOpen]);

  function togglePractice() {
    setUserOpen(false);
    setPracticeOpen((o) => {
      const next = !o;
      if (next && practiceRef.current) setPracticeRect(practiceRef.current.getBoundingClientRect());
      return next;
    });
  }
  function toggleUser() {
    setPracticeOpen(false);
    setUserOpen((o) => {
      const next = !o;
      if (next && userRef.current) setUserRect(userRef.current.getBoundingClientRect());
      return next;
    });
  }

  const MENU_GLASS = {
    background: "var(--glass-floating)",
    backdropFilter: "blur(26px) saturate(150%)",
    WebkitBackdropFilter: "blur(26px) saturate(150%)",
    border: "1px solid var(--glass-border-hi)",
    boxShadow: "0 1px 0 rgba(255,255,255,0.14) inset, 0 20px 60px rgba(0,0,0,0.55)",
  };

  const guarded = (to) => (e) => { if (!attemptNav(to)) e.preventDefault(); };
  const isActive = (to) => pathname === to || (to !== "/" && pathname.startsWith(to));
  const practiceActive = isActive("/setup") || isActive("/coach");

  return (
    <div className="sticky top-[18px] z-50 px-6">
      <nav
        className="mx-auto flex max-w-[1180px] items-center justify-between rounded-[18px] py-2.5 pl-[22px] pr-[14px] transition-shadow"
        style={{
          background: scrolled ? "rgba(20,23,31,0.7)" : "rgba(255,255,255,0.06)",
          backdropFilter: "blur(22px) saturate(150%)",
          WebkitBackdropFilter: "blur(22px) saturate(150%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: scrolled
            ? "0 1px 0 rgba(255,255,255,0.1) inset, 0 16px 44px rgba(0,0,0,0.5)"
            : "0 1px 0 rgba(255,255,255,0.08) inset, 0 8px 24px rgba(0,0,0,0.3)",
        }}
      >
        <Link to="/" onClick={guarded("/")} className="fx-logo flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="display text-xl tracking-tight text-foreground">
            graspr<span style={{ color: "var(--teal)" }}>.</span>in
          </span>
        </Link>

        {!user && (
          <div className="flex items-center gap-2.5">
            <Link to="/login" className="btn btn-glass fx-ring">Log in</Link>
            <Link to="/register" className="btn btn-primary fx-sheen">Sign up</Link>
          </div>
        )}

        {user && (
          <div
            className="flex items-center gap-1.5 rounded-[13px] p-[5px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}
          >
            <div className="relative" ref={practiceRef}>
              <button
                onClick={togglePractice}
                className="fx-ring flex items-center gap-1 rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
                style={
                  practiceOpen || practiceActive
                    ? { background: "rgba(93,202,165,0.12)", color: "var(--teal)" }
                    : { background: "transparent", color: "var(--text-2)" }
                }
              >
                Practice
                <Icon name="chevD" size={11} style={{ opacity: 0.7 }} />
              </button>
              {practiceOpen && practiceRect && createPortal(
                <div
                  ref={practiceMenuRef}
                  className="min-w-[184px] rounded-[14px] p-1.5"
                  style={{ position: "fixed", top: practiceRect.bottom + 10, left: practiceRect.left, zIndex: 60, ...MENU_GLASS }}
                >
                  <DropdownItem to="/setup" onClick={() => setPracticeOpen(false)} icon="book" iconColor="#8B93A7">
                    Trainer
                  </DropdownItem>
                  <DropdownItem to="/coach" onClick={() => setPracticeOpen(false)} icon="spark" iconColor="var(--periwinkle)" glow>
                    AI Coach
                  </DropdownItem>
                </div>,
                document.body
              )}
            </div>

            <Link
              to="/dashboard"
              onClick={guarded("/dashboard")}
              className="rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
              style={
                isActive("/dashboard")
                  ? { background: "var(--teal)", color: "#07130E" }
                  : { background: "transparent", color: "var(--text-2)" }
              }
            >
              Dashboard
            </Link>

            <div className="relative" ref={userRef}>
              <button
                onClick={toggleUser}
                className="fx-ring flex items-center gap-2 rounded-[9px] py-1.5 pl-1.5 pr-3 text-[13.5px] font-semibold"
                style={{ background: userOpen ? "rgba(255,255,255,0.08)" : "transparent", color: "var(--text)" }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[11px] font-bold"
                  style={{ background: "linear-gradient(140deg, var(--teal), var(--periwinkle))", color: "#07130E" }}
                >
                  {(user.name || user.username || "?").charAt(0).toUpperCase()}
                </span>
                {user.name || user.username}
                <Icon name="chevD" size={12} style={{ opacity: 0.7 }} />
              </button>

              {userOpen && userRect && createPortal(
                <div
                  ref={userMenuRef}
                  className="min-w-[196px] rounded-[14px] p-1.5"
                  style={{ position: "fixed", top: userRect.bottom + 10, right: Math.max(8, window.innerWidth - userRect.right), zIndex: 60, ...MENU_GLASS }}
                >
                  <div className="mono px-3 pb-1.5 pt-2 text-[10px] uppercase tracking-wide dim">{user.email}</div>
                  <DropdownItem to="/profile" onClick={() => setUserOpen(false)}>Profile</DropdownItem>
                  <DropdownItem to="/my-questions" onClick={() => setUserOpen(false)}>My Questions</DropdownItem>
                  {user.role === "admin" && (
                    <DropdownItem to="/admin" onClick={() => setUserOpen(false)}>Admin</DropdownItem>
                  )}
                  <DropdownButton onClick={() => { setUserOpen(false); setShowChangePassword(true); }}>
                    Change Password
                  </DropdownButton>
                  <DropdownButton onClick={() => { setUserOpen(false); setShowResetData(true); }}>
                    Reset all data
                  </DropdownButton>
                  <div className="my-1 h-px" style={{ background: "var(--glass-border-lo)" }} />
                  <button
                    onClick={() => { setUserOpen(false); logout(); }}
                    className="w-full rounded-[9px] px-3 py-2 text-left text-[13.5px] transition-colors"
                    style={{ color: "var(--red)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.12)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Log out
                  </button>
                </div>,
                document.body
              )}
            </div>
          </div>
        )}
      </nav>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showResetData && (
        <ResetDataModal
          onClose={() => setShowResetData(false)}
          onDone={() => { setShowResetData(false); navigate("/dashboard"); }}
        />
      )}
    </div>
  );
}

function DropdownButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[9px] px-3 py-2 text-left text-[13.5px] text-foreground transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setMsg("Password updated.");
      setCurrent("");
      setNext("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="glass-floating w-full max-w-sm p-6 space-y-3">
        <h2 className="font-semibold text-foreground">Change password</h2>
        <input
          type="password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className="input"
          required
        />
        <input
          type="password"
          placeholder="New password (min 6 chars)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={6}
          className="input"
          required
        />
        {err && <p className="text-sm text-destructive">{err}</p>}
        {msg && <p className="text-sm" style={{ color: "var(--green)" }}>{msg}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn btn-primary fx-sheen">
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-glass fx-ring">
            {msg ? "Done" : "Cancel"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetDataModal({ onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleReset() {
    setBusy(true);
    setErr(null);
    try {
      await resetAccount();
      clearActiveSession();
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="glass-floating w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">Reset all practice data?</h2>
        <p className="mt-2 text-sm muted">
          This will permanently delete all your sessions, attempts, and stats. Your account
          will remain active. This cannot be undone.
        </p>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleReset}
            disabled={busy}
            className="btn flex-1 disabled:opacity-60"
            style={{ background: "var(--red)", color: "#fff" }}
          >
            {busy ? "Resetting…" : "Yes, reset everything"}
          </button>
          <button onClick={onClose} disabled={busy} className="btn btn-glass fx-ring flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function DropdownItem({ to, onClick, icon, iconColor, glow = false, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13.5px] text-foreground transition-colors"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon && (
        <Icon
          name={icon}
          size={16}
          style={{ color: iconColor, flex: "none", animation: glow ? "aiTwinkle 2.6s ease-in-out infinite" : undefined }}
        />
      )}
      <span style={glow ? { color: "var(--periwinkle)" } : undefined}>{children}</span>
    </Link>
  );
}
