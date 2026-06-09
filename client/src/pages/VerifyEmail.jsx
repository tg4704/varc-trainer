import { useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { verifyEmail, resendOtp } from "../api.js";
import { Button } from "../components/ui/button.jsx";

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
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="mb-2 text-4xl">✉️</div>
      <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a 6-digit code to{" "}
        <span className="font-medium text-foreground">{email || "your email address"}</span>.
        Enter it below to verify your account.
      </p>

      <form onSubmit={handleSubmit} className="mt-8">
        {/* OTP boxes */}
        <div className="flex gap-2 justify-center mb-6">
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

        {error && (
          <p className="mb-4 text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={busy || otp.length < 6}
          className="w-full"
          size="lg"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Verifying…
            </span>
          ) : "Verify email"}
        </Button>
      </form>

      {/* Resend */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Didn't receive the code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendState === "sending"}
          className="font-medium text-foreground underline underline-offset-4 disabled:opacity-60"
        >
          {resendState === "sending" ? "Sending…" : "Resend code"}
        </button>
        {resendMsg && (
          <p className={`mt-2 text-xs ${resendState === "error" ? "text-destructive" : "text-success"}`}>
            {resendMsg}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Wrong email?{" "}
        <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
          Start over
        </Link>
      </p>
    </div>
  );
}
