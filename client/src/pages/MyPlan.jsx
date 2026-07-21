import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { billing } from "../api.js";
import Modal from "../components/Modal.jsx";
import SideDock from "../components/SideDock.jsx";

const TIER_ORDER = ["free", "inference", "ninetyninth", "topper"];
const TIER_LABELS = { free: "Skimmer", inference: "Inference", ninetyninth: "99th %ile", topper: "Topper" };

function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? "-" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// How a purchased plan reads in history + on the receipt.
function planLabel(p) {
  if (p.period === "cat") return `${p.tierName} · Till CAT ${p.seasonYear || ""}`.trim();
  return `${p.tierName} · ${p.months} month${p.months > 1 ? "s" : ""}`;
}

function openReceipt(payment, user) {
  const w = window.open("", "_blank");
  if (!w) return;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt - ${payment.orderId}</title>
<style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; max-width: 640px; margin: 48px auto; padding: 0 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 28px; }
  td { padding: 9px 0; font-size: 14px; border-bottom: 1px solid #e5e5e5; }
  td:first-child { color: #666; width: 40%; }
  td:last-child { text-align: right; font-weight: 600; }
  .total td { font-size: 16px; border-bottom: none; padding-top: 16px; }
  .foot { margin-top: 40px; font-size: 12px; color: #888; line-height: 1.6; }
  @media print { body { margin: 0; padding: 24px; } }
</style></head>
<body>
  <h1>Graspr</h1>
  <div class="muted">Payment Receipt</div>
  <table>
    <tr><td>Receipt date</td><td>${fmtDate(payment.capturedAt)}</td></tr>
    <tr><td>Billed to</td><td>${user?.name || user?.username || ""}${user?.email ? ` (${user.email})` : ""}</td></tr>
    <tr><td>Plan</td><td>${payment.period === "cat" ? `${payment.tierName} - Till CAT ${payment.seasonYear || ""}`.trim() : `${payment.tierName} - ${payment.months} month${payment.months > 1 ? "s" : ""}`}</td></tr>
    <tr><td>Order ID</td><td>${payment.orderId}</td></tr>
    ${payment.paymentId ? `<tr><td>Payment ID</td><td>${payment.paymentId}</td></tr>` : ""}
    <tr class="total"><td>Amount paid</td><td>₹${payment.amountInr}</td></tr>
  </table>
  <div class="foot">
    Issued by Tarun Gupta, operating Graspr, Bangalore, Karnataka, India.<br>
    Questions about this receipt: privacy@graspr.in<br>
    This is a computer-generated receipt for a one-time plan purchase and does not require a signature.
  </div>
  <script>window.print();</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
}

function UsageBar({ label, used, cap, period = "day" }) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const remaining = Math.max(0, cap - used);
  const per = period === "month" ? "month" : "today";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] muted">{label}</span>
        <span>
          <span className="mono text-[20px] font-semibold" style={{ color: "var(--teal)" }}>{used}</span>
          <span className="mono text-[14px] muted"> / {cap}</span>
        </span>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--teal), var(--periwinkle))" }}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] dim">{remaining} left this {per === "month" ? "month" : "day"}</span>
        <span className="flex items-center gap-1 text-[11px] dim">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />
          </svg>
          {period === "month" ? "Resets on the 1st IST" : "Resets 12:00 AM IST"}
        </span>
      </div>
    </div>
  );
}

export default function MyPlan() {
  const { user } = useAuth();
  const [me, setMe] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = () =>
    Promise.all([billing.me(), billing.payments()])
      .then(([meRes, paymentsRes]) => { setMe(meRes); setPayments(paymentsRes.payments); })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const tierKey = me?.tier ?? "free";
  const isPaid = me?.isPaid ?? false;
  const tierName = me?.tierName ?? "Skimmer";
  const sub = me?.subscription || null;
  // A live, not-yet-cancelling recurring plan → can be cancelled at period end.
  const canCancel = sub && !sub.cancelAtCycleEnd && ["active", "authenticated", "pending", "halted"].includes(sub.status);

  async function doCancel() {
    setCancelBusy(true);
    try {
      const res = await billing.cancelSubscription();
      await load();
      setCancelOpen(false);
      setNotice(`Subscription cancelled. You keep ${tierName} until ${fmtDate(res.accessUntil)}, then it stops renewing.`);
    } catch (e) {
      setError(e.message || "Couldn't cancel. Try again.");
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1080px] px-6 pb-16 pt-14">
      <SideDock />
      {/* Header */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute", top: -20, left: "50%", transform: "translateX(-50%)",
            // Capped to the container: a fixed 520px is wider than a phone
            // viewport and pushed the page's scrollWidth out past the screen.
            width: "min(520px, 100%)", height: 260, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(93,202,165,0.10), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <h1 className="display relative text-[38px] leading-none">My Plan</h1>
        <p className="relative mt-2.5 text-[14px] muted">Manage your subscription, usage, and billing.</p>
      </div>

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
      {notice && (
        <p className="mt-6 rounded-lg px-4 py-2.5 text-sm" style={{ background: "rgba(74,222,128,0.1)", color: "var(--green)" }}>{notice}</p>
      )}

      {me && (
        <div className="mt-9" style={{ animation: "fadeSlideUp 0.7s ease both" }}>
          {/* Top row: Card + Tier/Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-8 mb-10">
            {/* ── Membership card (credit card shape) ── */}
            <div
              className="relative overflow-hidden rounded-[22px]"
              style={{
                padding: "38px",
                background: "linear-gradient(150deg, #0B1E17 0%, #0E1528 100%)",
                border: "1px solid rgba(93,202,165,0.2)",
                boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(93,202,165,0.06) inset",
                color: "var(--text)",
              }}
            >
              {/* Mountain texture */}
              <img
                src="/hero.jpg"
                alt=""
                style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  objectFit: "cover", objectPosition: "50% 62%",
                  opacity: 0.07, mixBlendMode: "luminosity",
                }}
              />
              {/* Corner glows. These sit flush inside the card with the gradient
                  centred on the corner, rather than overhanging on negative
                  offsets - the overhang read the same but widened the page's
                  scrollWidth, letting the whole page scroll sideways on a phone
                  (the card's own overflow-hidden doesn't contain that). */}
              {/* Teal glow - top right */}
              <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, background: "radial-gradient(circle at 100% 0%, rgba(93,202,165,0.28), transparent 65%)", pointerEvents: "none" }} />
              {/* Periwinkle glow - bottom left */}
              <div style={{ position: "absolute", bottom: 0, left: 0, width: 180, height: 180, background: "radial-gradient(circle at 0% 100%, rgba(139,157,255,0.2), transparent 65%)", pointerEvents: "none" }} />
              {/* Shine stripe */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, transparent 40%)", pointerEvents: "none" }} />

              <div className="relative eyebrow" style={{ color: "rgba(255,255,255,0.48)", letterSpacing: "0.12em", fontSize: 11 }}>Graspr Membership</div>

              <div className="relative mt-4 flex items-center gap-3">
                <span className="display" style={{ fontSize: 38, color: "#fff" }}>{tierName}</span>
                {isPaid && (
                  <span
                    className="text-[10.5px] font-bold uppercase tracking-[0.08em] rounded-full px-3 py-1"
                    style={{ background: "rgba(93,202,165,0.14)", color: "var(--teal)", border: "1px solid rgba(93,202,165,0.3)" }}
                  >
                    Active
                  </span>
                )}
              </div>

              <div className="relative mt-10 flex items-end justify-between">
                <div>
                  <div className="mono font-bold" style={{ fontSize: 38, color: "var(--teal)" }}>
                    {me.priceInr > 0 ? `₹${me.priceInr}` : "Free"}
                    {me.priceInr > 0 && <span className="text-[15px] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>/mo</span>}
                  </div>
                  {me.expiresAt && (
                    <div className="mt-1 text-[12px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                      {canCancel
                        ? `Renews ${fmtDate(sub.currentEnd || me.expiresAt)}`
                        : sub?.cancelAtCycleEnd
                          ? `Cancelled · access until ${fmtDate(me.expiresAt)}`
                          : `Access until ${fmtDate(me.expiresAt)}`}
                    </div>
                  )}
                </div>
                <div className="text-right text-[11.5px]" style={{ color: "rgba(255,255,255,0.38)" }}>
                  {user?.name || user?.username}<br />@{user?.username}
                </div>
              </div>

              {isPaid ? (
                <>
                  <Link
                    to="/pricing"
                    className="relative mt-7 block w-full rounded-[12px] py-4 text-center text-[14px] font-semibold"
                    style={{ background: "rgba(93,202,165,0.12)", color: "var(--teal)", border: "1px solid rgba(93,202,165,0.28)" }}
                  >
                    Change or extend plan
                  </Link>
                  {canCancel && (
                    <button
                      onClick={() => setCancelOpen(true)}
                      className="relative mt-2.5 block w-full rounded-[12px] py-3 text-center text-[13px] font-medium"
                      style={{ color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      Cancel subscription
                    </button>
                  )}
                  {sub?.cancelAtCycleEnd && (
                    <p className="relative mt-3 text-center text-[12px]" style={{ color: "rgba(255,255,255,0.42)" }}>
                      Auto-renew is off. Access ends {fmtDate(me.expiresAt)}.
                    </p>
                  )}
                </>
              ) : (
                <Link
                  to="/pricing"
                  className="relative mt-7 block w-full rounded-[12px] py-4 text-center text-[14px] font-semibold fx-sheen"
                  style={{ background: "var(--teal)", color: "#07130E" }}
                >
                  Upgrade plan
                </Link>
              )}
            </div>

            {/* ── Right column (Tier + Usage) ── */}
            <div className="flex flex-col gap-4" style={{ animation: "fadeSlideUp 0.7s ease both", animationDelay: "0.1s" }}>
              {/* Tier indicator pills */}
              <div>
                <div className="eyebrow mb-2.5">Your plan tier</div>
                <div className="grid grid-cols-4 gap-2">
                  {TIER_ORDER.map((key) => {
                    const isCurrent = key === tierKey;
                    return (
                      <div
                        key={key}
                        className="rounded-[12px] py-3 text-center text-[10.5px] font-semibold"
                        style={isCurrent
                          ? {
                            background: "rgba(93,202,165,0.14)", border: "1px solid rgba(93,202,165,0.5)",
                            color: "var(--teal)", animation: "softPulseTeal 3s ease-in-out infinite",
                          }
                          : {
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                            color: "var(--text-muted)",
                          }}
                      >
                        {TIER_LABELS[key]}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Usage - daily or monthly depending on the plan */}
              {me.usage && (() => {
                const period = me.usage.period || "day";
                const caps = period === "month" ? (me.monthlyCaps || {}) : (me.caps || {});
                if (caps.drills == null && caps.coach == null) return null;
                return (
                  <div
                    className="rounded-[16px] p-5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div className="flex flex-col gap-4">
                      {caps.drills != null && (
                        <UsageBar label="AI reasonings (Drills)" used={me.usage.drills} cap={caps.drills} period={period} />
                      )}
                      {caps.coach != null && (
                        <UsageBar label="Coach passages" used={me.usage.coach} cap={caps.coach} period={period} />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ── Purchase history (full width below) ── */}
          <div style={{ animation: "fadeSlideUp 0.7s ease both", animationDelay: "0.2s" }}>
            <div className="eyebrow mb-2.5">Purchase history</div>

            {!payments && <div className="text-sm muted">Loading…</div>}

            {payments && payments.length === 0 && (
              <div
                className="rounded-[16px] p-6 text-center"
                style={{ border: "1px dashed rgba(255,255,255,0.16)" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                  <path d="M4 5.5A2 2 0 0 1 6 3.5h13v15H6a2 2 0 0 0-2 2z" />
                  <path d="M19 18.5H6a2 2 0 0 0-2 2" />
                </svg>
                <p className="mt-3 text-[13px] muted">No purchases yet. You're on the free Skimmer plan.</p>
              </div>
            )}

            {payments && payments.length > 0 && (
              <div className="flex flex-col gap-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-[12px] p-4"
                    style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {planLabel(p)}
                      </div>
                      <div className="mt-0.5 text-xs dim">{fmtDate(p.capturedAt)} · ₹{p.amountInr}</div>
                    </div>
                    <button
                      onClick={() => openReceipt(p, user)}
                      className="btn btn-glass fx-ring flex-none"
                      style={{ padding: "7px 12px", fontSize: 12.5 }}
                    >
                      Receipt
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {cancelOpen && sub && (
        <Modal onClose={() => (cancelBusy ? null : setCancelOpen(false))} closeOnBackdrop={!cancelBusy} labelledBy="cancel-title">
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-floating animate-slide-up w-full max-w-md p-7"
          >
            <h2 id="cancel-title" className="display text-[24px] leading-tight">Cancel {tierName}?</h2>
            <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--glass-border-lo)" }}>
              <ul className="flex flex-col gap-2 text-[13px] muted">
                <li>• You keep <span className="text-foreground font-medium">{tierName}</span> until <span className="text-foreground font-medium">{fmtDate(sub.currentEnd || me.expiresAt)}</span>.</li>
                <li>• No further charges after that - it simply stops renewing.</li>
                <li>• No refund for the current period (you've got full access to it).</li>
                <li>• You can resubscribe anytime.</li>
              </ul>
            </div>
            <button
              onClick={doCancel}
              disabled={cancelBusy}
              className="btn mt-6 w-full"
              style={{ background: "rgba(248,113,113,0.14)", color: "var(--destructive, #f87171)", border: "1px solid rgba(248,113,113,0.3)" }}
            >
              {cancelBusy ? "Cancelling…" : "Yes, cancel at period end"}
            </button>
            <button
              onClick={() => setCancelOpen(false)}
              disabled={cancelBusy}
              className="mt-2 w-full text-center text-[13px] dim hover:text-foreground disabled:opacity-50"
            >
              Keep my subscription
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
