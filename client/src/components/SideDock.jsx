// Scroll-locked right-edge dock: icon-only tabs (Updates + Blog) that reveal
// their full panel on hover. Fixed to the viewport so it stays put while the
// page scrolls; desktop-only (hidden below lg). Mounted on the logged-in
// surfaces (Home, Drills setup, Coach chooser, Dashboard, Profile, My Plan).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { bulletins as bulletinsApi } from "../api.js";
import Icon from "./Icon.jsx";

function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const FLOAT_STYLE = {
  background: "var(--bg-elevated, #14171F)",
  border: "1px solid var(--border-subtle)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
};

function BulletinBox({ isAdmin }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    bulletinsApi.list().then((data) => setItems(data.bulletins)).catch(() => setItems([]));
  }, []);

  const empty = items && items.length === 0;

  return (
    <div className="relative overflow-hidden rounded-[16px] p-7" style={FLOAT_STYLE}>
      <div className="relative flex items-center justify-between gap-2 mb-5">
        <div className="flex items-center gap-2">
          <Icon name="megaphone" size={14} style={{ color: "var(--amber)" }} />
          <span className="eyebrow" style={{ color: "var(--amber)" }}>Important Updates</span>
        </div>
        {isAdmin && (
          <Link to="/admin/bulletins" className="fx-underline text-[12.5px] font-semibold" style={{ color: "var(--periwinkle)" }}>
            Manage →
          </Link>
        )}
      </div>
      {!items && <p className="relative text-[14px] muted">Loading…</p>}
      {empty && <p className="relative text-[14px] muted">No updates posted yet.</p>}
      {items && items.length > 0 && (
        <div className="relative flex flex-col gap-4">
          {items.map((b) => (
            <div key={b.id}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[13.5px] font-semibold text-foreground">{b.title}</div>
                <span className="mono flex-none text-[10.5px] dim">{fmtDate(b.created_at)}</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed muted">{b.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlogUpdatesBox() {
  return (
    <div className="relative overflow-hidden rounded-[16px] p-7" style={FLOAT_STYLE}>
      <div className="relative flex items-center gap-2 mb-5">
        <Icon name="notepad" size={14} style={{ color: "var(--periwinkle)" }} />
        <span className="eyebrow" style={{ color: "var(--periwinkle)" }}>From the Blog</span>
      </div>
      <p className="relative text-[14px] leading-relaxed muted">
        We're writing up strategy notes and CAT VARC breakdowns. First posts are on the way.
      </p>
      <Link to="/blog" className="relative fx-underline mt-3.5 inline-block text-[13px] font-semibold" style={{ color: "var(--teal)" }}>
        Visit the blog →
      </Link>
    </div>
  );
}

// One icon-only right-edge tab + its hover-revealed panel.
function DockItem({ id, icon, label, color, open, setOpen, to, children }) {
  const isOpen = open === id;
  const tabStyle = {
    width: 48,
    height: 48,
    background: isOpen ? `${color}26` : "rgba(20,23,31,0.94)",
    border: `1px solid ${isOpen ? color : "var(--border-subtle)"}`,
    borderRight: "none",
    borderRadius: "14px 0 0 14px",
    color,
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    transition: "background .2s ease, border-color .2s ease",
  };
  return (
    <div
      className="relative flex items-center justify-end"
      onMouseEnter={() => setOpen(id)}
      onMouseLeave={() => setOpen(null)}
    >
      {/* Hover panel - slides out to the left of the tab */}
      <div
        style={{
          position: "absolute",
          right: "100%",
          marginRight: 12,
          top: "50%",
          width: 360,
          maxWidth: "min(360px, calc(100vw - 90px))",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transform: `translateY(-50%) translateX(${isOpen ? 0 : 12}px)`,
          transition: "opacity .22s ease, transform .22s ease",
        }}
      >
        {children}
      </div>

      {/* Right-edge icon tab - a Link when `to` is set, else a plain button */}
      {to ? (
        <Link to={to} aria-label={label} title={label} className="flex items-center justify-center" style={tabStyle}>
          <Icon name={icon} size={20} />
        </Link>
      ) : (
        <button type="button" aria-label={label} title={label} className="flex items-center justify-center" style={tabStyle}>
          <Icon name={icon} size={20} />
        </button>
      )}
    </div>
  );
}

export default function SideDock() {
  const { user } = useAuth();
  const [open, setOpen] = useState(null);
  if (!user) return null;
  return (
    <div
      className="hidden lg:flex flex-col items-end gap-3"
      style={{ position: "fixed", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 45 }}
    >
      <DockItem id="updates" icon="megaphone" label="Updates" color="var(--amber)" open={open} setOpen={setOpen}>
        <BulletinBox isAdmin={user?.role === "admin"} />
      </DockItem>
      <DockItem id="blog" icon="notepad" label="Blog" color="var(--periwinkle)" to="/blog" open={open} setOpen={setOpen}>
        <BlogUpdatesBox />
      </DockItem>
    </div>
  );
}
