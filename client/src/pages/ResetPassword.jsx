import { useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { resetPassword, resendOtp } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Input } from "../components/ui/input.jsx";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const inputRefs = useRef([]);

  const otp = digits.join("");

  function handleDigit(index, value) {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 6) {
      setDigits(cleaned.split(""));
      inputRefs.current[5]?.focus();
      return;
    }
    const char = cleaned.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]; next[index] = ""; setDigits(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (otp.length < 6) return setError("Please enter the complete 6-digit code.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");
    if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
    setError(null);
    setBusy(true);
    try {
      const { token, user } = await resetPassword({ email, otp, newPassword });
      loginWithToken(token, user);
      navigate("/setup", { replace: true });
    } catch (err) {
      setError(err.message);
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setResendMsg("");
    try {
      await resendOtp({ email, purpose: "password_reset" });
      setResendMsg("New code sent.");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setResendMsg(err.message);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="mb-2 text-4xl">🔐</div>
      <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the 6-digit code sent to{" "}
        <span className="font-medium text-foreground">{email || "your email"}</span>{" "}
        and choose a new password.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {/* OTP boxes */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Verification code</p>
          <div className="flex gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="h-14 w-12 rounded-lg border border-input bg-background text-center text-2xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 transition-colors"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleResend}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Resend code
          </button>
          {resendMsg && (
            <p className="mt-1 text-xs text-muted-foreground">{resendMsg}</p>
          )}
        </div>

        <label className="block">
          <span className="block text-sm font-medium text-foreground mb-1">New password</span>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-foreground mb-1">Confirm password</span>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={busy || otp.length < 6}
          className="w-full"
          size="lg"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Resetting…
            </span>
          ) : "Reset password"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-muted-foreground text-center">
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
