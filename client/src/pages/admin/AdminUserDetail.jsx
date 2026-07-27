import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { admin } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Badge } from "../../components/ui/badge.jsx";

function fmtDate(s) {
  if (!s) return "-";
  return new Date(s).toLocaleString();
}
function fmtUsd(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "-";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

const TIER_LABELS = { free: "Skimmer (free)", inference: "Inference", ninetyninth: "99th Percentile", topper: "Topper" };

// Plan limits + consumption for one metered unit. `cap === null` means the tier
// has no limit of this kind (the top tiers drop the daily cap for a monthly
// pool), which is a real state and not the same as a cap of 0.
function UsageBar({ label, used, cap, unit }) {
  const unlimited = cap == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / cap) * 100));
  const atLimit = !unlimited && used >= cap;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px]" style={atLimit ? { color: "var(--red)" } : undefined}>
          {unlimited ? `${used} · no limit` : `${used} / ${cap}`}
          {atLimit ? " · at limit" : ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: unlimited ? "100%" : `${pct}%`,
            background: atLimit ? "var(--red)" : pct >= 80 ? "var(--amber)" : "var(--teal)",
            opacity: unlimited ? 0.18 : 1,
          }}
        />
      </div>
      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{unit}</div>
    </div>
  );
}

function UsageLimits({ e }) {
  const periodLabel = e.period === "month" ? "this month" : "today";
  return (
    <div className="mb-3 rounded-md border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Limits &amp; usage ({periodLabel})</span>
        {!e.enforced && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: "rgba(240,168,104,0.14)", color: "var(--amber)" }}
            title="ENABLE_TIERS is off — these limits are not currently being enforced"
          >
            not enforced
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <UsageBar label="AI reasonings" used={e.used.drills} cap={e.caps?.drills} unit={`Drills · per ${e.period}`} />
        <UsageBar label="Coach passages" used={e.used.coach} cap={e.caps?.coach} unit={`Coach · per ${e.period}`} />
      </div>
      {e.period === "month" && (
        <p className="mt-2 text-[10.5px] text-muted-foreground">
          Today so far: {e.today.drills} reasonings · {e.today.coach} passages
        </p>
      )}
      <p className="mt-1 text-[10.5px] text-muted-foreground">Resets at midnight IST.</p>
    </div>
  );
}
const PAID_TIERS = ["inference", "ninetyninth", "topper"];

export default function AdminUserDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // ?edit=1 lets the users-table "Edit" button land straight in the open form.
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [form, setForm] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const reload = () => admin.getUser(id).then(setData).catch((e) => setError(e.message));
  // Wrap so the effect returns undefined, not reload()'s Promise (React would
  // call it as a cleanup fn on unmount → "n is not a function" crash).
  useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-linked ?edit=1 arrives before the fetch resolves, so seed the form as
  // soon as the user row lands rather than in the click handler.
  const loadedUser = data?.user;
  useEffect(() => {
    if (editing && loadedUser && !form) {
      setForm({ username: loadedUser.username || "", email: loadedUser.email || "", name: loadedUser.name || "" });
    }
  }, [editing, loadedUser, form]);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const { user, totals, recentSessions, apiCost, coachStats, subscription, entitlement } = data;

  async function changeRole(newRole) {
    setBusy(true);
    try { await admin.patchUser(user.id, { role: newRole }); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function resetData() {
    if (!confirm(`Wipe ALL practice history for ${user.username} — Drills, Coach and spaced repetition? The account itself stays.`)) return;
    setBusy(true);
    try { await admin.resetUserData(user.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function changeTier(tier, months = 1) {
    setBusy(true);
    try { await admin.setUserTier(user.id, tier, months); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function startEditing() {
    setForm({ username: user.username || "", email: user.email || "", name: user.name || "" });
    setSaveError(null);
    setEditing(true);
  }
  function stopEditing() {
    setEditing(false);
    setForm(null);
    setSaveError(null);
    if (searchParams.get("edit")) setSearchParams({}, { replace: true });
  }
  async function saveDetails() {
    setBusy(true);
    setSaveError(null);
    try {
      // Send only what actually changed, so an untouched unique field can never
      // collide with itself or clobber a concurrent edit.
      const patch = {};
      if (form.username.trim() !== (user.username || "")) patch.username = form.username.trim();
      if (form.email.trim() !== (user.email || "")) patch.email = form.email.trim();
      if (form.name.trim() !== (user.name || "")) patch.name = form.name.trim();
      if (Object.keys(patch).length) await admin.patchUser(user.id, patch);
      await reload();
      stopEditing();
    } catch (e) { setSaveError(e.message); }
    finally { setBusy(false); }
  }

  async function forceCancel() {
    if (!confirm(`Force-cancel ${user.username}'s subscription and drop them to free RIGHT NOW? This cancels the Razorpay mandate immediately (no period-end grace) and cannot be undone.`)) return;
    setBusy(true);
    try { await admin.forceCancelSubscription(user.id); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const isSelf = me?.id === user.id;
  const answered = totals.answered || 0;
  const accuracy = answered ? Math.round((totals.correct / answered) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to users
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{user.username}</h1>
            <p className="text-sm text-muted-foreground">
              {user.email}, joined {fmtDate(user.created_at)}
              {user.name ? ` · ${user.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.tier && user.tier !== "free" && (
              <Badge variant="default">{TIER_LABELS[user.tier] || user.tier}</Badge>
            )}
            {user.role === "admin"
              ? <Badge variant="default">admin</Badge>
              : <Badge variant="secondary">user</Badge>}
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>Edit details</Button>
            )}
          </div>
        </div>
      </div>

      {editing && form && (
        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">Edit details</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">Username</span>
              <Input className="mt-1" value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Email</span>
              <Input className="mt-1" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Display name</span>
              <Input className="mt-1" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
          </div>
          {saveError && <p className="mt-3 text-sm text-destructive">{saveError}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={saveDetails}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={stopEditing}>Cancel</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Attempts</div>
          <div className="mt-1 text-xl font-bold text-foreground">{totals.attempts}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Accuracy</div>
          <div className="mt-1 text-xl font-bold text-foreground">{accuracy}%</div>
          <div className="text-xs text-muted-foreground">{totals.correct} / {answered}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Trap picks</div>
          <div className="mt-1 text-xl font-bold text-foreground">{totals.trapPicks}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">AI spend</div>
          <div className="mt-1 text-xl font-bold text-foreground">{fmtUsd(apiCost.cost)}</div>
          <div className="text-xs text-muted-foreground">{apiCost.calls} calls</div>
        </CardContent></Card>
      </div>

      {/* Actions */}
      <Card><CardContent className="p-4">
        <div className="text-sm font-semibold mb-3">Actions</div>
        <div className="flex flex-wrap gap-2">
          {user.role === "user" ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => changeRole("admin")}>
              Promote to admin
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy || isSelf}
              title={isSelf ? "Cannot demote yourself" : ""}
              onClick={() => changeRole("user")}>
              Demote to user
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to={`/admin/users/${user.id}/dashboard`}>View their dashboard</Link>
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={resetData}>
            Reset all data
          </Button>
        </div>
      </CardContent></Card>

      {/* Plan */}
      <Card><CardContent className="p-4">
        <div className="text-sm font-semibold mb-1">Plan</div>
        <p className="text-xs text-muted-foreground mb-3">
          Current: <span className="font-medium text-foreground">{TIER_LABELS[user.tier] || user.tier || "Skimmer (free)"}</span>
          {user.tier_expires_at ? ` · expires ${fmtDate(user.tier_expires_at)}` : " · no expiry"}
          {entitlement && entitlement.effectiveTier !== (user.tier || "free") && (
            <> · <span style={{ color: "var(--amber)" }}>expired → billed as {entitlement.tierName}</span></>
          )}
        </p>

        {/* Usage against plan limits — the first thing you want when a user
            writes in about being blocked. */}
        {entitlement && <UsageLimits e={entitlement} />}
        <div className="flex flex-wrap items-center gap-2">
          {PAID_TIERS.map((t) => (
            <Button key={t} variant="outline" size="sm" disabled={busy} onClick={() => changeTier(t, 1)}>
              Grant {TIER_LABELS[t]} (1 mo)
            </Button>
          ))}
          <Button variant="ghost" size="sm" disabled={busy || (user.tier || "free") === "free"} onClick={() => changeTier("free")}>
            Revoke to free
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Granting extends an existing paid plan by the months given; revoking drops to free immediately.</p>

        {subscription && (
          <div className="mt-4 rounded-md border border-border p-3">
            <div className="text-xs font-semibold mb-1">Recurring subscription (autopay)</div>
            <p className="text-[11px] text-muted-foreground">
              {TIER_LABELS[subscription.tier] || subscription.tier} · status <span className="font-medium text-foreground">{subscription.status}</span>
              {subscription.cancelAtCycleEnd ? " · cancelling at period end" : ""}
              {subscription.currentEnd ? ` · paid through ${fmtDate(subscription.currentEnd)}` : ""}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{subscription.id}</p>
            <Button variant="destructive" size="sm" className="mt-2" disabled={busy} onClick={forceCancel}>
              Force-cancel &amp; drop to free now
            </Button>
          </div>
        )}
      </CardContent></Card>

      {/* Recent sessions */}
      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Recent practice sessions</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">#</th>
              <th className="text-left font-medium px-3 py-2">Questions</th>
              <th className="text-left font-medium px-3 py-2">Timer</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Started</th>
            </tr>
          </thead>
          <tbody>
            {recentSessions.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted-foreground py-4">No sessions yet</td></tr>
            )}
            {recentSessions.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 tabular-nums">{s.id}</td>
                <td className="px-3 py-2">{s.num_questions}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.timer_mode}</td>
                <td className="px-3 py-2">
                  <Badge variant={s.status === "completed" ? "success" : "secondary"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Coach sessions */}
      {coachStats && (
        <Card>
          <div className="p-4 border-b border-border text-sm font-semibold">
            Reading Coach sessions
            <span className="ml-2 text-muted-foreground font-normal">({coachStats.total} total)</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">#</th>
                <th className="text-left font-medium px-3 py-2">Article</th>
                <th className="text-left font-medium px-3 py-2">Questions</th>
                <th className="text-left font-medium px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {coachStats.recentSessions.length === 0 && (
                <tr><td colSpan={4} className="text-center text-muted-foreground py-4">No Coach sessions yet</td></tr>
              )}
              {coachStats.recentSessions.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{s.id}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{s.article_title || "Untitled"}</td>
                  <td className="px-3 py-2">{s.questions}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
