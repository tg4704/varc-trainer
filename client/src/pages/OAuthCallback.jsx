import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";

// Handles the redirect from the backend after Google OAuth.
// URL: /oauth-callback?token=JWT&user=JSON  (or ?error=reason)
export default function OAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const token   = params.get("token");
    const userRaw = params.get("user");
    const error   = params.get("error");

    if (error || !token || !userRaw) {
      const msg = {
        google_cancelled:    "Sign-in was cancelled.",
        google_state_invalid:"Security check failed. Please try again.",
        google_no_email:     "Google didn't share your email. Check your Google account permissions.",
        google_failed:       "Google sign-in failed. Please try again.",
      }[error] || "Google sign-in failed. Please try again.";
      navigate(`/login?oauthError=${encodeURIComponent(msg)}`, { replace: true });
      return;
    }

    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      loginWithToken(token, user);
      navigate("/setup", { replace: true });
    } catch {
      navigate("/login?oauthError=oauth_parse_error", { replace: true });
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
