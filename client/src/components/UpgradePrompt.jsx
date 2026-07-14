import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "./Modal.jsx";
import { Button } from "./ui/button.jsx";

// App-level listener for plan-limit hits. api.js fires `graspr:limit-reached`
// with the server's 402 payload whenever a daily cap (or the kill-switch, if
// ever enabled) blocks an AI call. We surface it once, centrally, so any AI
// call anywhere gets a consistent upgrade prompt instead of a raw error.
export default function UpgradePrompt() {
  const [detail, setDetail] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onLimit = (e) => setDetail(e.detail || {});
    window.addEventListener("graspr:limit-reached", onLimit);
    return () => window.removeEventListener("graspr:limit-reached", onLimit);
  }, []);

  if (!detail) return null;

  const isCostCeiling = detail.reason === "cost_ceiling";
  const title = isCostCeiling ? "Monthly AI limit reached" : "You've hit today's limit";
  const canUpgrade = Boolean(detail.upgradeTo && detail.upgradeName);
  const close = () => setDetail(null);

  return (
    <Modal onClose={close} labelledBy="upgrade-title">
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="upgrade-title" className="display text-[22px]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed muted">
          {detail.error || "You've reached a limit on your current plan."}
          {canUpgrade && !isCostCeiling && (
            <> Upgrade to <span className="font-semibold text-foreground">{detail.upgradeName}</span> for a higher daily limit, or come back tomorrow when it resets.</>
          )}
          {!canUpgrade && !isCostCeiling && <> It resets tomorrow.</>}
        </p>
        <div className="mt-6 flex gap-2.5">
          {canUpgrade && (
            <Button className="fx-sheen flex-1" onClick={() => { close(); navigate("/pricing"); }}>
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
