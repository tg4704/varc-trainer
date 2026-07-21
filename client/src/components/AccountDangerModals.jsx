// Shared "danger zone" modals - used from both the TopNav avatar dropdown
// and the Profile page's Danger zone section, so the two entry points stay
// in sync instead of drifting into two copies.
import { useState } from "react";
import Modal from "./Modal.jsx";
import { resetAccount, deleteAccount } from "../api.js";
import { clearActiveSession } from "../session.js";

export function ResetDataModal({ onClose, onDone, returnFocusTo }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function handleReset() {
    setBusy(true);
    setErr(null);
    try {
      await resetAccount();
      clearActiveSession();
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? undefined : onClose} labelledBy="reset-data-title" returnFocusTo={returnFocusTo}>
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="reset-data-title" className="text-lg font-bold text-foreground">Reset all practice data?</h2>
        <p className="mt-2 text-sm muted">
          This will permanently delete all your sessions, attempts, and stats. Your account
          will remain active. This cannot be undone.
        </p>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleReset}
            disabled={busy}
            className="btn flex-1 disabled:opacity-60"
            style={{ background: "var(--red)", color: "#fff" }}
          >
            {busy ? "Resetting…" : "Yes, reset everything"}
          </button>
          <button onClick={onClose} disabled={busy} className="btn btn-glass fx-ring flex-1">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Permanently deletes the account - distinct from Reset (which keeps the
// account, just wipes data). Requires typing DELETE to reduce misclicks on
// something irreversible.
export function DeleteAccountModal({ onClose, onDeleted, returnFocusTo }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  async function handleDelete() {
    if (!canDelete || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteAccount();
      clearActiveSession();
      onDeleted();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? undefined : onClose} labelledBy="delete-account-title" returnFocusTo={returnFocusTo}>
      <div className="glass-floating w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="delete-account-title" className="text-lg font-bold" style={{ color: "var(--red)" }}>Delete your account?</h2>
        <p className="mt-2 text-sm muted">
          This permanently deletes your account, every session, attempt, and stat. There is no
          undo and no recovery. Sign-in will stop working immediately.
        </p>
        <label className="mt-4 block">
          <span className="text-xs muted">Type <strong className="text-foreground">DELETE</strong> to confirm</span>
          <input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDelete()}
            className="input mt-1.5"
            placeholder="DELETE"
          />
        </label>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleDelete}
            disabled={!canDelete || busy}
            className="btn flex-1 disabled:opacity-40"
            style={{ background: "var(--red)", color: "#fff" }}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </button>
          <button onClick={onClose} disabled={busy} className="btn btn-glass fx-ring flex-1">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
