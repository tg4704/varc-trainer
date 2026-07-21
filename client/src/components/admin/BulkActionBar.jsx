import { useState } from "react";
import Modal from "../Modal.jsx";
import { Button } from "../ui/button.jsx";

// Selection + bulk-action toolbar shared by Admin → Questions and Admin → Passages.
// Both lists are flat id-keyed tables, so the only thing that differs between them
// is the noun and the API call, both passed in.
//
// Delete is destructive and irreversible, so it always routes through a confirm
// modal; activate/deactivate apply immediately (they're trivially reversible).
export default function BulkActionBar({ noun, selected, onClear, onRun }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const count = selected.length;
  if (count === 0) return null;

  async function run(action) {
    setBusy(true);
    setErr(null);
    try {
      await onRun(action);
      setConfirming(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <span className="text-sm text-foreground">
          {count} {noun}{count === 1 ? "" : "s"} selected
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run("activate")}>
            Activate
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run("deactivate")}>
            Deactivate
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => setConfirming(true)}>
            Delete
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      {err && !confirming && <p className="text-sm text-destructive">{err}</p>}

      {confirming && (
        <Modal
          onClose={busy ? undefined : () => setConfirming(false)}
          closeOnBackdrop={false}
          labelledBy="bulk-delete-title"
        >
          <div
            className="glass-floating w-full max-w-sm p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="bulk-delete-title" className="text-lg font-bold" style={{ color: "var(--red)" }}>
              Delete {count} {noun}{count === 1 ? "" : "s"}?
            </h2>
            <p className="mt-2 text-sm muted">
              This permanently removes {count === 1 ? "it" : "them"} from the bank. There is no undo.
              If you only want {count === 1 ? "it" : "them"} out of circulation, use Deactivate instead.
            </p>
            {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => run("delete")}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// Checkbox styled to match the admin tables. Kept here so both pages get the
// same hit-area and label without repeating the markup.
export function RowCheckbox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => el && (el.indeterminate = indeterminate)}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer accent-[var(--teal)]"
    />
  );
}
