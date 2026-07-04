// Universal top nav — floating glass pill shown on every logged-in,
// non-session page (Home, Dashboard, Coach hub, Drills setup, Profile, My
// Questions, Results, etc). Replaces the old fragmented model (floating pill
// on Home only / glass sidebar on hub pages / plain bar everywhere else)
// with one consistent bar: Practice ▾ (Trainer / AI Coach) · Dashboard ·
// avatar ▾ (Profile / My Questions / Admin / Log out).
//
// In-session pages (/practice, /coach/practice) get their own minimal
// session bar (Exit / progress / timer) instead of this — see App.jsx.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useNavGuard } from "../navGuard.jsx";
import { BrandMark } from "./AuthShell.jsx";
import Icon from "./Icon.jsx";

export default function TopNav() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { attemptNav } = useNavGuard();
  const [scrolled, setScrolled] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const practiceRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!practiceOpen && !userOpen) return;
    function onDocClick(e) {
      if (practiceRef.current && !practiceRef.current.contains(e.target)) setPracticeOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [practiceOpen, userOpen]);

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
                onClick={() => setPracticeOpen((o) => !o)}
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
              {practiceOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+10px)] min-w-[184px] rounded-[14px] p-1.5"
                  style={{
                    background: "rgba(24,27,35,0.86)",
                    backdropFilter: "blur(26px) saturate(150%)",
                    WebkitBackdropFilter: "blur(26px) saturate(150%)",
                    border: "1px solid var(--glass-border-hi)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
                  }}
                >
                  <DropdownItem to="/setup" onClick={() => setPracticeOpen(false)} icon="book" iconColor="#8B93A7">
                    Trainer
                  </DropdownItem>
                  <DropdownItem to="/coach" onClick={() => setPracticeOpen(false)} icon="spark" iconColor="var(--periwinkle)" glow>
                    AI Coach
                  </DropdownItem>
                </div>
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
                onClick={() => setUserOpen((o) => !o)}
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

              {userOpen && (
                <div
                  className="absolute right-0 top-[calc(100%+10px)] min-w-[196px] rounded-[14px] p-1.5"
                  style={{
                    background: "rgba(24,27,35,0.86)",
                    backdropFilter: "blur(26px) saturate(150%)",
                    WebkitBackdropFilter: "blur(26px) saturate(150%)",
                    border: "1px solid var(--glass-border-hi)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
                  }}
                >
                  <div className="mono px-3 pb-1.5 pt-2 text-[10px] uppercase tracking-wide dim">{user.email}</div>
                  <DropdownItem to="/profile" onClick={() => setUserOpen(false)}>Profile</DropdownItem>
                  <DropdownItem to="/my-questions" onClick={() => setUserOpen(false)}>My Questions</DropdownItem>
                  {user.role === "admin" && (
                    <DropdownItem to="/admin" onClick={() => setUserOpen(false)}>Admin</DropdownItem>
                  )}
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
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
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
