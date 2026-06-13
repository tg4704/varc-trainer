import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

export function AuthShell({ children }) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center px-6 pb-12 pt-16 sm:pt-24">
      <Link to="/" className="mb-7 display text-xl tracking-tight">
        graspr<span style={{ color: "var(--teal)" }}>.</span>
      </Link>
      {children}
    </div>
  );
}

export function AuthTabs({ active }) {
  const tabs = [
    ["login", "Sign in", "/login"],
    ["register", "Create account", "/register"],
  ];
  return (
    <div className="mb-[26px] flex gap-[22px]" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      {tabs.map(([id, label, to]) => (
        <Link
          key={id}
          to={to}
          className="pb-[13px] text-[15px] font-medium"
          style={{
            color: active === id ? "var(--text)" : "var(--text-muted)",
            borderBottom: active === id ? "2px solid var(--teal)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function AuthDivider({ label }) {
  return (
    <div className="my-[18px] flex items-center gap-3.5">
      <hr className="hairline flex-1" />
      <span className="text-xs dim">{label}</span>
      <hr className="hairline flex-1" />
    </div>
  );
}

export function GoogleButton({ href }) {
  return (
    <a href={href} className="btn btn-ghost btn-block">
      <Icon name="google" size={17} /> Continue with Google
    </a>
  );
}

export function PasswordField({ label, value, onChange, hint, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="relative">
        <input
          className="input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          style={{ paddingRight: 42 }}
          placeholder="••••••••"
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label="Toggle password visibility"
          className="absolute right-2.5 top-1/2 grid -translate-y-1/2 place-items-center"
          style={{ color: "var(--text-muted)" }}
        >
          <Icon name={show ? "eyeOff" : "eye"} size={17} />
        </button>
      </div>
      {hint}
    </div>
  );
}
