import { useId, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

// Centered full-height wrapper. The body already carries the ambient glow.
// The gradient brand mark sits at the top so every auth page stays branded,
// including the ones still on the legacy card until their own reskin.
export function AuthShell({ children }) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 py-16">
      <Link to="/" className="mb-7 flex items-center gap-2.5">
        <BrandMark size={30} />
        <span className="display text-xl tracking-tight text-foreground">
          graspr<span style={{ color: "var(--teal)" }}>.</span>
        </span>
      </Link>
      {children}
    </div>
  );
}

// The frosted-glass auth card: heading + subhead, then the form.
export function AuthCard({ title, subtitle, children, footer }) {
  return (
    <>
      <div className="glass-floating w-[424px] max-w-full rounded-[20px] p-9">
        <div className="mb-6 flex flex-col items-center gap-1.5 text-center">
          <div className="text-[20px] font-semibold tracking-tight text-foreground">{title}</div>
          {subtitle && <div className="text-[13px] muted">{subtitle}</div>}
        </div>
        {children}
      </div>
      {footer && (
        <p className="mt-[18px] max-w-[360px] text-center text-xs leading-relaxed dim">{footer}</p>
      )}
    </>
  );
}

export function BrandMark({ size = 38 }) {
  const inner = Math.round(size * 0.33);
  const outerRadius = Math.round(size * 0.3);
  const innerRadius = Math.max(2, Math.round(size * 0.1));
  // No drop-shadow — the soft teal glow read as "smudgy" at small nav size.
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: size, height: size, borderRadius: outerRadius,
        background: "linear-gradient(140deg, var(--teal), var(--periwinkle))",
      }}
    >
      <div style={{ width: inner, height: inner, borderRadius: innerRadius, background: "var(--bg)" }} />
    </div>
  );
}

// Segmented pill toggle between /login and /register. Looks like a control,
// but each half is a real route link so our separate pages stay intact.
export function AuthTabs({ active }) {
  const tabs = [
    ["login", "Log in", "/login"],
    ["register", "Sign up", "/register"],
  ];
  return (
    <div
      className="mb-[22px] flex gap-1 rounded-[11px] p-1"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}
    >
      {tabs.map(([id, label, to]) => {
        const on = active === id;
        return (
          <Link
            key={id}
            to={to}
            className="flex-1 rounded-[8px] py-2 text-center text-[13px] font-semibold transition-colors"
            style={
              on
                ? { background: "var(--teal)", color: "#07130E" }
                : { background: "transparent", color: "var(--text-2)" }
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return (
    <div
      className="mb-4 flex items-center gap-2.5 rounded-[10px] px-3 py-2.5"
      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
      <span className="text-[12.5px]" style={{ color: "#F8A0A0" }}>{children}</span>
    </div>
  );
}

export function AuthDivider({ label }) {
  return (
    <div className="my-4 flex items-center gap-3.5">
      <hr className="hairline flex-1" />
      <span className="text-xs dim">{label}</span>
      <hr className="hairline flex-1" />
    </div>
  );
}

export function GoogleButton({ href }) {
  return (
    <a href={href} className="btn btn-glass btn-block fx-ring">
      <Icon name="google" size={17} /> Continue with Google
    </a>
  );
}

export function PasswordField({ label, value, onChange, hint, autoComplete, placeholder = "••••••••" }) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      <div className="relative">
        <input
          id={id}
          className="input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          style={{ paddingRight: 56 }}
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="mono absolute right-3 top-1/2 -translate-y-1/2 text-[11px]"
          style={{ color: "var(--text-2)" }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {hint}
    </div>
  );
}
