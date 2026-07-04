import { useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { resetPassword, resendOtp } from "../api.js";
import { AuthShell, AuthCard, AuthError, PasswordField } from "../components/AuthShell.jsx";

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
    <AuthShell>
      <AuthCard
        title="Reset password"
        subtitle={<>Enter the code sent to <span className="text-foreground font-medium">{email || "your email"}</span> and choose a new password.</>}
      >
        <AuthError>{error}</AuthError>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="field-label text-center block">Verification code</label>
            <div className="flex gap-2 justify-center">
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
                  className="otp-box"
                />
              ))}
            </div>
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={handleResend}
                className="fx-underline text-xs font-semibold"
                style={{ color: "var(--teal)" }}
              >
                Resend code
              </button>
              {resendMsg && <p className="mt-1 text-xs muted">{resendMsg}</p>}
            </div>
          </div>

          <PasswordField label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

          <button type="submit" disabled={busy || otp.length < 6} className="btn btn-primary btn-block fx-sheen">
            {busy ? "Resetting…" : <>Reset password <span className="arrow inline-block">→</span></>}
          </button>
        </form>

        <div className="mt-5 text-center text-[13px] muted">
          <Link to="/login" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
            Back to log in
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
