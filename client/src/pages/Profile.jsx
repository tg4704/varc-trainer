import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { getDashboard, changePassword, resetAccount } from "../api.js";
import { clearActiveSession } from "../session.js";

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const joined = user?.createdAt ? new Date(user.createdAt + "Z").toLocaleDateString() : "—";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Profile</h1>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Row label="Username" value={user?.username} />
        <Row label="Email" value={user?.email} />
        <Row label="Joined" value={joined} />
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <Stat label="Answered" value={stats.answeredCount} />
          <Stat label="Correct" value={stats.correctCount} />
          <Stat label="Accuracy" value={`${Math.round(stats.accuracy * 100)}%`} />
        </div>
      )}

      <ChangePassword />

      <div className="mt-8 flex gap-3">
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          Log out
        </button>
        <ResetData onReset={() => setStats(null)} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-center">
      <div className="text-xl font-bold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setMsg("Password updated.");
      setCurrent("");
      setNext("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-6 text-sm font-medium text-slate-700 underline underline-offset-4"
      >
        Change password
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
      <h2 className="font-semibold text-slate-900">Change password</h2>
      <input
        type="password"
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        autoComplete="current-password"
        className="input"
        required
      />
      <input
        type="password"
        placeholder="New password (min 6 chars)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        autoComplete="new-password"
        minLength={6}
        className="input"
        required
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:bg-slate-300"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ResetData({ onReset }) {
  const [showDialog, setShowDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleReset() {
    setBusy(true);
    try {
      await resetAccount();
      clearActiveSession();
      onReset();
      setShowDialog(false);
      setToast({ type: "success", msg: "All practice data has been reset." });
    } catch (e) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-medium text-red-600 hover:border-red-500 hover:bg-red-50"
      >
        Reset all data
      </button>

      {/* Confirmation dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Reset all practice data?</h2>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently delete all your sessions, attempts, and stats. Your account
              will remain active. This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReset}
                disabled={busy}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "Resetting…" : "Yes, reset everything"}
              </button>
              <button
                onClick={() => setShowDialog(false)}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
          toast.type === "success"
            ? "bg-slate-900 text-white"
            : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
