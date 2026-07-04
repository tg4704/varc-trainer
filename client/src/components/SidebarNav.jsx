// Glass sidebar nav — hub pages (Dashboard now; Coach History / Reading
// Lounge once built) per the contextual nav model: floating pill on Home,
// sidebar here, minimal top bar in-session (Coach practice / Drills).
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useNavGuard } from "../navGuard.jsx";
import { BrandMark } from "./AuthShell.jsx";
import Icon from "./Icon.jsx";
import { cn } from "../lib/utils.js";

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  coach: <path d="M12 3l1.7 4.4L18 9l-4.3 1.6L12 15l-1.7-4.4L6 9l4.3-1.6z" />,
  drills: <path d="M5 3l14 9-14 9z" />,
  questions: <><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" /><path d="M9 3v18" /></>,
};

const NAV_ITEMS = [
  ["/dashboard", "Dashboard", "dashboard"],
  ["/coach", "Coach", "coach"],
  ["/setup", "Drills", "drills"],
  ["/my-questions", "My Questions", "questions"],
];

export default function SidebarNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { attemptNav } = useNavGuard();

  const guarded = (to) => (e) => { if (!attemptNav(to)) e.preventDefault(); };
  const isActive = (to) => pathname === to || (to !== "/" && pathname.startsWith(to));

  return (
    <aside
      className="sticky top-0 flex h-screen w-[248px] min-w-[248px] flex-col gap-1 p-3.5"
      style={{ background: "rgba(255,255,255,0.035)", backdropFilter: "blur(20px) saturate(140%)", WebkitBackdropFilter: "blur(20px) saturate(140%)", borderRight: "1px solid var(--glass-border-lo)" }}
    >
      <Link to="/" onClick={guarded("/")} className="mb-4 flex items-center gap-2.5 px-2 pt-1">
        <BrandMark size={30} />
        <span className="display text-xl tracking-tight text-foreground">
          graspr<span style={{ color: "var(--teal)" }}>.</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(([to, label, icon]) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={guarded(to)}
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors"
              style={
                active
                  ? { background: "rgba(93,202,165,0.12)", border: "1px solid rgba(93,202,165,0.22)", color: "var(--text)" }
                  : { border: "1px solid transparent", color: "var(--text-2)" }
              }
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? "var(--teal)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[icon]}
              </svg>
              {label}
            </Link>
          );
        })}
        {user?.role === "admin" && (
          <Link
            to="/admin"
            onClick={guarded("/admin")}
            className={cn("flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors", isActive("/admin") ? "text-foreground" : "text-muted-foreground")}
            style={{ border: "1px solid transparent" }}
          >
            <Icon name="flag" size={16} /> Admin
          </Link>
        )}
      </nav>

      <Link
        to="/profile"
        onClick={guarded("/profile")}
        className="mt-auto flex items-center gap-2.5 rounded-[12px] p-2.5 transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}
      >
        <span
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-[13px] font-bold"
          style={{ background: "linear-gradient(140deg, var(--periwinkle), var(--teal))", color: "#07130E" }}
        >
          {(user?.name || user?.username || "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">{user?.name || user?.username}</div>
          <div className="dim text-[11px]">View profile</div>
        </div>
      </Link>
    </aside>
  );
}
