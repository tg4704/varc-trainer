// Email sending via Resend.
// Set RESEND_API_KEY env var for real email delivery.
// Set RESEND_FROM_EMAIL to a verified sender domain (e.g. noreply@yourdomain.com).
// Without RESEND_API_KEY the OTP is just printed to the server console (dev mode).

const { Resend } = require("resend");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP    = "Graspr";

async function sendEmail(to, subject, html) {
  if (!resend) {
    // Dev fallback - log OTP to console so you can test without Resend
    console.log(`\n[email] ── DEV MODE - email not sent ──`);
    console.log(`[email] To:      ${to}`);
    console.log(`[email] Subject: ${subject}`);
    console.log(`[email] Body:    ${html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}\n`);
    return { ok: true };
  }
  const result = await resend.emails.send({ from: FROM, to, subject, html });
  if (result.error) throw new Error(result.error.message || "Email send failed");
  return result;
}

async function sendOtpEmail(to, otp, purpose) {
  const boldOtp = `<div style="font-size:38px;font-weight:700;letter-spacing:10px;color:#0f766e;padding:20px 0">${otp}</div>`;

  if (purpose === "email_verification") {
    return sendEmail(
      to,
      `${otp} is your ${APP} verification code`,
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <p style="font-size:20px;font-weight:700;margin:0 0 4px">${APP}</p>
        <p style="color:#555;margin:0 0 12px">Verify your email address to activate your account.</p>
        ${boldOtp}
        <p style="color:#555;font-size:14px">This code expires in <strong>15 minutes</strong>.<br>
        If you didn't create an account, you can safely ignore this email.</p>
      </div>`
    );
  }

  if (purpose === "password_reset") {
    return sendEmail(
      to,
      `${otp} is your ${APP} password reset code`,
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <p style="font-size:20px;font-weight:700;margin:0 0 4px">${APP}</p>
        <p style="color:#555;margin:0 0 12px">Use this code to reset your password.</p>
        ${boldOtp}
        <p style="color:#555;font-size:14px">This code expires in <strong>15 minutes</strong>.<br>
        If you didn't request a reset, you can safely ignore this email.</p>
      </div>`
    );
  }

  throw new Error(`Unknown OTP purpose: ${purpose}`);
}

// Sent when someone tries to register with an email that's already an
// account - instead of the register route telling the *requester* that
// directly (a user-enumeration leak, since it reveals whether an email is a
// Graspr user to anyone who tries), we tell the *actual account owner*
// instead. The requester just sees the normal "check your email" response.
async function sendAccountExistsNotice(to) {
  return sendEmail(
    to,
    `Someone tried to sign up with your ${APP} email`,
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <p style="font-size:20px;font-weight:700;margin:0 0 4px">${APP}</p>
      <p style="color:#555;margin:0 0 12px">
        Someone just tried to create a new ${APP} account using this email address, which already
        has an account.
      </p>
      <p style="color:#555;font-size:14px">
        If this was you, you already have an account - try logging in, or use "Forgot password" if
        you don't remember your password.<br>
        If this wasn't you, no action is needed - your account is safe and nothing has changed.
      </p>
    </div>`
  );
}

module.exports = { sendOtpEmail, sendAccountExistsNotice };
