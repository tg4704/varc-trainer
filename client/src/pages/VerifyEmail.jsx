import { useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { verifyEmail, resendOtp } from "../api.js";
import { AuthShell, AuthCard, AuthError } from "../components/AuthShell.jsx";
import { AUTH } from "../lib/limits.js";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent | error
  const [resendMsg, setResendMsg] = useState("");
  const inputRefs = useRef([]);

  const otp = digits.join("");

  function handleDigit(index, value) {
    // Accept only a single digit (or paste of 6 digits)
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length === 6) {
      // Pasted full code
      const arr = cleaned.split("");
      setDigits(arr);
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
        const next = [...digits];
        next[index] = "";
        setDigits(next);
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
    setError(null);
    setBusy(true);
    try {
      const { token, user } = await verifyEmail({ email, otp });
      loginWithToken(token, user);
      navigate("/setup", { replace: true });
    } catch (err) {
      setError(err.message);
      // Clear digits on wrong code so user can retry cleanly
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setResendState("sending");
    setResendMsg("");
    try {
      await resendOtp({ email, purpose: "email_verification" });
      setResendState("sent");
      setResendMsg("A new code has been sent.");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setResendState("error");
      setResendMsg(err.message);
    }
  }

  return (
    <AuthShell>
      <AuthCard
        title="Check your email"
        subtitle={<>We sent a 6-digit code to <span className="text-foreground font-medium">{email || "your email address"}</span>.</>}
      >
        <AuthError>{error}</AuthError>

        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 justify-center mb-2">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={AUTH.OTP_LENGTH}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="otp-box"
              />
            ))}
          </div>

          <button type="submit" disabled={busy || otp.length < 6} className="btn btn-primary btn-block fx-sheen mt-5">
            {busy ? "Verifying…" : <>Verify email <span className="arrow inline-block">→</span></>}
          </button>
        </form>

        <div className="mt-5 text-center text-[13px] muted">
          Didn't receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === "sending"}
            className="fx-underline font-semibold disabled:opacity-60"
            style={{ color: "var(--teal)" }}
          >
            {resendState === "sending" ? "Sending…" : "Resend code"}
          </button>
          {resendMsg && (
            <p className="mt-2 text-xs" style={{ color: resendState === "error" ? "var(--red)" : "var(--green)" }}>
              {resendMsg}
            </p>
          )}
        </div>

        <div className="mt-3 text-center text-[13px] muted">
          Wrong email?{" "}
          <Link to="/register" className="fx-underline font-semibold" style={{ color: "var(--teal)" }}>
            Start over
          </Link>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
