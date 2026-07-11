import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAnalyticsConsent, grantAnalyticsConsent, denyAnalyticsConsent } from "../analytics.js";

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => getAnalyticsConsent() === null);

  useEffect(() => {
    function reopen() { setVisible(true); }
    window.addEventListener("graspr:reopen-cookie-banner", reopen);
    return () => window.removeEventListener("graspr:reopen-cookie-banner", reopen);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4">
      <div
        className="flex w-full max-w-[640px] flex-col gap-3 rounded-[16px] p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background: "rgba(18,20,27,0.94)",
          backdropFilter: "blur(26px) saturate(150%)",
          WebkitBackdropFilter: "blur(26px) saturate(150%)",
          border: "1px solid var(--glass-border-hi)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.14) inset, 0 20px 60px rgba(0,0,0,0.55)",
        }}
      >
        <p className="text-[13px] leading-relaxed muted">
          We use analytics cookies to understand how Graspr is used and improve it. Essential
          sign-in doesn't need your consent — this is only for optional analytics. See our{" "}
          <Link to="/privacy" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
            Privacy Policy
          </Link>.
        </p>
        <div className="flex shrink-0 gap-2.5">
          <button
            onClick={() => { denyAnalyticsConsent(); setVisible(false); }}
            className="btn btn-glass fx-ring"
          >
            Decline
          </button>
          <button
            onClick={() => { grantAnalyticsConsent(); setVisible(false); }}
            className="btn btn-primary fx-sheen"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
