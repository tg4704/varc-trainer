// Universal top nav - floating glass pill shown on every logged-in,
// non-session page (Home, Dashboard, Coach hub, Drills setup, Profile, My
// Questions, Results, etc). Replaces the old fragmented model (floating pill
// on Home only / glass sidebar on hub pages / plain bar everywhere else)
// with one consistent bar: Practice ▾ (Trainer / AI Coach) · Dashboard ·
// avatar ▾ (Profile / My Questions / Admin / Change Password / Reset all
// data / Log out). Change Password and Reset all data open modals directly
// from here rather than navigating to Profile.
//
// In-session pages (/practice, /coach/practice) get their own minimal
// session bar (Exit / progress / timer) instead of this - see App.jsx.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useNavGuard } from "../navGuard.jsx";
import { BrandMark } from "./AuthShell.jsx";
import Icon from "./Icon.jsx";
import { changePassword, exportAccountData } from "../api.js";
import { scrollIntoViewMotionSafe } from "../lib/utils.js";
import Modal from "./Modal.jsx";
import Avatar from "./Avatar.jsx";
import { ResetDataModal, DeleteAccountModal } from "./AccountDangerModals.jsx";
import { AUTH } from "../lib/limits.js";

export default function TopNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { attemptNav } = useNavGuard();
  const [scrolled, setScrolled] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showResetData, setShowResetData] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const userRef = useRef(null);
  // The avatar dropdown is portaled to <body> so it escapes this nav's
  // backdrop-filter - a backdrop-filter nested inside another backdrop-filter
  // renders as a flat translucent panel (no visible blur). Its position is
  // measured from the trigger button on open.
  const userMenuRef = useRef(null);
  const [userRect, setUserRect] = useState(null);

  // Focus-restore target for modals launched from the account dropdown.
  // A getter (not a plain ref) because userRef wraps the trigger in a
  // positioning <div>; the focusable element is the button inside it, and it
  // has to be resolved at close time rather than captured at open time.
  const accountButton = () => userRef.current?.querySelector("button") || null;

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      setUserOpen(false);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!userOpen) return;
    function onDocClick(e) {
      const inUser = userRef.current?.contains(e.target) || userMenuRef.current?.contains(e.target);
      if (!inUser) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [userOpen]);

  async function handleExport() {
    setExporting(true);
    try {
      await exportAccountData();
      setShowExportConfirm(false);
    } catch {
      // Non-critical UX - silent failure is fine, user can just retry from the menu.
    } finally {
      setExporting(false);
    }
  }

  function toggleUser() {
    setUserOpen((o) => {
      const next = !o;
      if (next && userRef.current) setUserRect(userRef.current.getBoundingClientRect());
      return next;
    });
  }

  // Dark, high-opacity fill (not the lighter `--glass-floating` white tint used
  // for cards) - a portaled dropdown sits directly over colored nav pills
  // (active Dashboard button, avatar gradient), and a low-opacity white tint
  // lets that color bleed through the blur as a visible smudge. Same recipe as
  // QuestionStepper's popover, which doesn't have this problem.
  const MENU_GLASS = {
    background: "rgba(18,20,27,0.94)",
    backdropFilter: "blur(26px) saturate(150%)",
    WebkitBackdropFilter: "blur(26px) saturate(150%)",
    border: "1px solid var(--glass-border-hi)",
    boxShadow: "0 1px 0 rgba(255,255,255,0.14) inset, 0 20px 60px rgba(0,0,0,0.55)",
  };

  const guarded = (to) => (e) => { if (!attemptNav(to)) e.preventDefault(); };
  const isActive = (to) => pathname === to || (to !== "/" && pathname.startsWith(to));

  return (
    <div
      className="sticky z-50"
      style={{
        top: scrolled ? 18 : 0,
        paddingInline: scrolled ? "clamp(16px, 2vw, 24px)" : 0,
        transition: "top 360ms cubic-bezier(.2,.8,.2,1), padding-inline 360ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <nav
        className="mx-auto grid grid-cols-[1fr_auto] items-center gap-3 py-2.5 pl-4 pr-2.5 md:grid-cols-[1fr_auto_1fr] md:pl-[22px] md:pr-[14px]"
        style={{
          width: "100%",
          maxWidth: scrolled ? 1180 : "100%",
          borderRadius: scrolled ? 18 : 0,
          background: scrolled ? "rgba(20,23,31,0.7)" : "rgba(20,23,31,0.32)",
          backdropFilter: "blur(22px) saturate(150%)",
          WebkitBackdropFilter: "blur(22px) saturate(150%)",
          border: scrolled ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.08)",
          borderLeftWidth: scrolled ? 1 : 0,
          borderRightWidth: scrolled ? 1 : 0,
          borderTopWidth: scrolled ? 1 : 0,
          boxShadow: scrolled
            ? "0 1px 0 rgba(255,255,255,0.1) inset, 0 16px 44px rgba(0,0,0,0.5)"
            : "0 1px 0 rgba(255,255,255,0.08) inset, 0 12px 36px rgba(0,0,0,0.22)",
          transition: "max-width 360ms cubic-bezier(.2,.8,.2,1), border-radius 360ms cubic-bezier(.2,.8,.2,1), background 360ms cubic-bezier(.2,.8,.2,1), border-color 360ms cubic-bezier(.2,.8,.2,1), border-width 360ms cubic-bezier(.2,.8,.2,1), box-shadow 360ms cubic-bezier(.2,.8,.2,1)",
          // Forces its own GPU compositing layer. Without this, the inline
          // background/box-shadow swap on every scroll event (the `scrolled`
          // toggle above) can leave a stale, smudged composited frame behind
          // on an element with backdrop-filter - a known Chromium artifact
          // when backdrop-filter styles mutate outside a CSS transition.
          transform: "translateZ(0)",
          isolation: "isolate",
        }}
      >
        <Link to="/" onClick={guarded("/")} className="fx-logo flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="display whitespace-nowrap text-xl tracking-tight text-foreground">
            graspr<span style={{ color: "var(--teal)" }}>.</span>in
          </span>
        </Link>

        {/* Center group: the three practice surfaces, as distinct top-level
            buttons rather than a single dropdown - each is one click away.
            Hidden below md: the avatar dropdown carries Drills/Coach/Dashboard
            on phones instead (logged-out gets logo + auth buttons only). */}
        {user ? (
          <div className="hidden items-center justify-center gap-1 md:flex">
            <NavPillTooltip label="Reading Lounge" sublabel="Coming Soon">
              <span
                className="flex cursor-default items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold"
                style={{ color: "var(--text-2)", opacity: 0.55 }}
              >
                Lounge
                <span className="mono rounded-full px-1.5 py-0.5 text-[8.5px] uppercase tracking-wide" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)" }}>Soon</span>
              </span>
            </NavPillTooltip>
            <Link
              to="/setup"
              onClick={guarded("/setup")}
              className="rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
              style={
                isActive("/setup")
                  ? { background: "rgba(93,202,165,0.12)", color: "var(--teal)" }
                  : { background: "transparent", color: "var(--text-2)" }
              }
            >
              Drills
            </Link>
            <Link
              to="/coach"
              onClick={guarded("/coach")}
              className="flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
              style={
                isActive("/coach")
                  ? { background: "rgba(139,157,255,0.14)", color: "var(--periwinkle)" }
                  : { background: "transparent", color: "var(--text-2)" }
              }
            >
              <Icon name="spark" size={14} style={{ animation: "aiTwinkle 2.6s ease-in-out infinite" }} />
              Coach
            </Link>
          </div>
        ) : (
          <div className="hidden items-center justify-center gap-1 md:flex">
            <SectionLink id="why" label="Why Graspr?" pathname={pathname} navigate={navigate} />
            <SectionLink id="try" label="Demo" pathname={pathname} navigate={navigate} />
            <SectionLink id="how" label="How it works?" pathname={pathname} navigate={navigate} />
            <Link
              to="/pricing"
              className="rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
              style={
                isActive("/pricing")
                  ? { background: "rgba(93,202,165,0.12)", color: "var(--teal)" }
                  : { background: "transparent", color: "var(--text-2)" }
              }
            >
              Pricing
            </Link>
            <Link
              to="/blog"
              className="rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
              style={
                isActive("/blog")
                  ? { background: "rgba(93,202,165,0.12)", color: "var(--teal)" }
                  : { background: "transparent", color: "var(--text-2)" }
              }
            >
              Blog
            </Link>
          </div>
        )}

        {!user && (
          <div className="flex items-center justify-self-end gap-2.5">
            <Link to="/login" className="btn btn-glass fx-ring">Log in</Link>
            <Link to="/register" className="btn btn-primary fx-sheen">Sign up</Link>
          </div>
        )}

        {user && (
          <div className="flex items-center justify-self-end gap-1.5">
            <Link
              to="/dashboard"
              onClick={guarded("/dashboard")}
              className="hidden rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors md:block"
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
                aria-label="Account menu"
                className="fx-ring flex items-center gap-2 rounded-[9px] py-1.5 pl-1.5 pr-2 text-[13.5px] font-semibold md:pr-3"
                style={{ background: userOpen ? "rgba(255,255,255,0.08)" : "transparent", color: "var(--text)" }}
              >
                <Avatar avatarId={user.avatarId} name={user.name || user.username} size={24} radius={7} />
                <span className="hidden md:inline">{user.name || user.username}</span>
                <Icon name="chevD" size={12} style={{ opacity: 0.7 }} />
              </button>

              {userOpen && userRect && createPortal(
                <div
                  ref={userMenuRef}
                  className="min-w-[196px] rounded-[14px] p-1.5"
                  style={{ position: "fixed", top: userRect.bottom + 10, right: Math.max(8, window.innerWidth - userRect.right), zIndex: 60, ...MENU_GLASS }}
                >
                  <div className="mono px-3 pb-1.5 pt-2 text-[10px] uppercase tracking-wide dim">{user.email}</div>
                  {/* Mobile-only: the center nav pills + Dashboard collapse into
                      this menu below md (the bar can't fit them on phones). */}
                  <div className="md:hidden">
                    <DropdownItem
                      to="/setup"
                      onClick={(e) => { if (!attemptNav("/setup")) e.preventDefault(); setUserOpen(false); }}
                    >
                      Drills
                    </DropdownItem>
                    <DropdownItem
                      to="/coach"
                      onClick={(e) => { if (!attemptNav("/coach")) e.preventDefault(); setUserOpen(false); }}
                    >
                      Coach
                    </DropdownItem>
                    <DropdownItem
                      to="/dashboard"
                      onClick={(e) => { if (!attemptNav("/dashboard")) e.preventDefault(); setUserOpen(false); }}
                    >
                      Dashboard
                    </DropdownItem>
                    <div className="my-1 h-px" style={{ background: "var(--glass-border-lo)" }} />
                  </div>
                  <DropdownItem to="/profile" onClick={() => setUserOpen(false)}>Profile</DropdownItem>
                  <DropdownItem to="/my-plan" onClick={() => setUserOpen(false)}>My Plan</DropdownItem>
                  {/* My Questions temporarily disabled - see App.jsx route redirect */}
                  {user.role === "admin" && (
                    <DropdownItem to="/admin" onClick={() => setUserOpen(false)}>Admin</DropdownItem>
                  )}
                  <DropdownButton onClick={() => { setUserOpen(false); setShowChangePassword(true); }}>
                    Change Password
                  </DropdownButton>
                  <DropdownButton onClick={() => { setUserOpen(false); setShowExportConfirm(true); }}>
                    Export my data
                  </DropdownButton>
                  <DropdownButton onClick={() => { setUserOpen(false); setShowResetData(true); }}>
                    Reset all data
                  </DropdownButton>
                  <button
                    onClick={() => { setUserOpen(false); setShowDeleteAccount(true); }}
                    className="w-full rounded-[9px] px-3 py-2 text-left text-[13.5px] transition-colors"
                    style={{ color: "var(--red)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.12)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Delete account
                  </button>
                  <div className="my-1 h-px" style={{ background: "var(--glass-border-lo)" }} />
                  <button
                    onClick={() => { setUserOpen(false); logout(); }}
                    className="w-full rounded-[9px] px-3 py-2 text-left text-[13.5px] text-foreground transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
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

      {/* returnFocusTo: each of these is launched from the account dropdown,
          whose item unmounts in the same click that opens the modal. Without an
          explicit target, focus restoration lands on <body> and a keyboard user
          restarts from the top of the page. Point at the avatar button, which
          is stable across the dropdown opening and closing. */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          returnFocusTo={accountButton}
        />
      )}
      {showExportConfirm && (
        <ExportDataModal
          busy={exporting}
          onConfirm={handleExport}
          onClose={() => { if (!exporting) setShowExportConfirm(false); }}
          returnFocusTo={accountButton}
        />
      )}
      {showResetData && (
        <ResetDataModal
          onClose={() => setShowResetData(false)}
          onDone={() => { setShowResetData(false); navigate("/dashboard"); }}
          returnFocusTo={accountButton}
        />
      )}
      {showDeleteAccount && (
        <DeleteAccountModal
          onClose={() => setShowDeleteAccount(false)}
          onDeleted={() => { setShowDeleteAccount(false); logout(); navigate("/"); }}
          returnFocusTo={accountButton}
        />
      )}
    </div>
  );
}

// Logged-out nav item that scrolls to a section of the Home page. On Home it
// smooth-scrolls directly; from any other route it navigates to /#id and
// ScrollToTop (App.jsx) scrolls to the target once Home mounts.
function SectionLink({ id, label, pathname, navigate }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (pathname === "/") {
          scrollIntoViewMotionSafe(document.getElementById(id));
        } else {
          navigate(`/#${id}`);
        }
      }}
      className="rounded-[9px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors"
      style={{ background: "transparent", color: "var(--text-2)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
    >
      {label}
    </button>
  );
}

// Small hover tooltip for a disabled/not-yet-built nav item (Lounge).
function NavPillTooltip({ label, sublabel, children }) {
  return (
    <div className="group relative">
      {children}
      <div
        className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-10 w-max -translate-x-1/2 rounded-[8px] px-2.5 py-1.5 text-center text-[11.5px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ background: "rgba(18,20,27,0.96)", border: "1px solid var(--glass-border-hi)", color: "var(--text-2)" }}
      >
        <div className="font-semibold text-foreground">{label}</div>
        {sublabel && <div className="mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

function DropdownButton({ onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[9px] px-3 py-2 text-left text-[13.5px] text-foreground transition-colors disabled:opacity-50"
      style={{ background: "transparent" }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function ExportDataModal({ busy, onConfirm, onClose, returnFocusTo }) {
  return (
    <Modal onClose={onClose} labelledBy="export-data-title" closeOnBackdrop={!busy} returnFocusTo={returnFocusTo}>
      <div className="glass-floating w-full max-w-md p-7">
        <h2 id="export-data-title" className="display text-[22px]">Export my data</h2>
        <p className="mt-3 text-[14px] leading-relaxed muted">
          This downloads a JSON file with your profile, all your Drills sessions and attempts,
          Coach sessions, and spaced-repetition cards. It doesn't change or delete anything.
        </p>
        <p className="mt-2.5 text-[13px] dim">
          The file may contain personal data - keep it somewhere safe.
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-glass fx-ring disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className="btn btn-primary fx-sheen fx-ring">
            {busy ? "Preparing…" : "Download export"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ChangePasswordModal({ onClose, returnFocusTo }) {
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
    <Modal onClose={busy ? undefined : onClose} labelledBy="change-password-title" returnFocusTo={returnFocusTo}>
      <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="glass-floating w-full max-w-sm p-6 space-y-3 animate-slide-up">
        <h2 id="change-password-title" className="font-semibold text-foreground">Change password</h2>
        <input
          type="password"
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          maxLength={AUTH.PASSWORD_MAX}
          className="input"
          required
        />
        <input
          type="password"
          placeholder="New password (min 6 chars)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          minLength={AUTH.PASSWORD_MIN}
          maxLength={AUTH.PASSWORD_MAX}
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
    </Modal>
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
