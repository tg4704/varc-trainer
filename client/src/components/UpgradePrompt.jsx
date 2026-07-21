import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import { Button } from "./ui/button.jsx";

// App-level listener for plan-limit hits. api.js fires `graspr:limit-reached`
// with the server's 402 payload whenever a daily cap (or the kill-switch, if
// ever enabled) blocks an AI call. We surface it once, centrally, so any AI
// call anywhere gets a consistent upgrade prompt instead of a raw error.
export default function UpgradePrompt() {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    const onLimit = (e) => setDetail(e.detail || {});
    window.addEventListener("graspr:limit-reached", onLimit);
    return () => window.removeEventListener("graspr:limit-reached", onLimit);
  }, []);

  if (!detail) return null;

  const isCostCeiling = detail.reason === "cost_ceiling";
  // A locked FEATURE is not a spent quota: it never "resets tomorrow", and
  // saying so told free users to wait for something that will never happen
  // (and quietly talked them out of the upgrade that would actually fix it).
  const isFeatureLocked = detail.reason === "feature_locked";
  const title = isCostCeiling
    ? "Monthly AI limit reached"
    : isFeatureLocked
      ? "Not included in your plan"
      : "You've hit today's limit";
  const canUpgrade = Boolean(detail.upgradeTo && detail.upgradeName);
  const close = () => setDetail(null);

  // This prompt only ever fires because an AI call was blocked mid-activity —
  // a Coach passage or a Drills session in progress. Navigating the SPA to
  // /pricing threw that away: the user lost their place, and (before the
  // resume fix) burned a Coach passage they couldn't finish. Opening a new tab
  // keeps the session live and warm, so after paying they switch back and
  // carry on exactly where they stopped. Called straight from the click
  // handler, so popup blockers allow it.
  const openPricing = () => {
    window.open("/pricing", "_blank", "noopener,noreferrer");
    close();
  };

  return (
    <Modal onClose={close} labelledBy="upgrade-title">
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="upgrade-title" className="display text-[22px]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed muted">
          {detail.error || "You've reached a limit on your current plan."}
          {canUpgrade && isFeatureLocked && (
            <> Upgrade to <span className="font-semibold text-foreground">{detail.upgradeName}</span> to unlock it.</>
          )}
          {canUpgrade && !isCostCeiling && !isFeatureLocked && (
            <> Upgrade to <span className="font-semibold text-foreground">{detail.upgradeName}</span> for a higher daily limit, or come back tomorrow when it resets.</>
          )}
          {!canUpgrade && !isCostCeiling && !isFeatureLocked && <> It resets tomorrow.</>}
        </p>
        {canUpgrade && (
          <p className="mt-2 text-xs muted">
            Plans open in a new tab — this session stays exactly where it is.
          </p>
        )}
        <div className="mt-6 flex gap-2.5">
          {canUpgrade && (
            <Button className="fx-sheen flex-1" onClick={openPricing}>
              See plans
            </Button>
          )}
          <Button variant={canUpgrade ? "outline" : "default"} className={canUpgrade ? "" : "flex-1"} onClick={close}>
            {canUpgrade ? "Not now" : "OK"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
