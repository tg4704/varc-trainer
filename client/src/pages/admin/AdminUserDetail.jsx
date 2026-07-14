import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { admin } from "../../api.js";
import { useAuth } from "../../auth.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Badge } from "../../components/ui/badge.jsx";

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleString();
}
function fmtUsd(n) {
  n = Number(n);
  if (!Number.isFinite(n)) return "—";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

const TIER_LABELS = { free: "Skimmer (free)", inference: "Inference", ninetyninth: "99th Percentile", topper: "Topper" };
const PAID_TIERS = ["inference", "ninetyninth", "topper"];

export default function AdminUserDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = () => admin.getUser(id).then(setData).catch((e) => setError(e.message));
  // Wrap so the effect returns undefined, not reload()'s Promise (React would
  // call it as a cleanup fn on unmount → "n is not a function" crash).
  useEffect(() => { reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const { user, totals, recentSessions, apiCost, coachStats } = data;

  async function changeRole(newRole) {
    setBusy(true);
    try { await admin.patchUser(user.id, { role: newRole }); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function resetData() {
    if (!confirm(`Wipe ALL sessions and attempts for ${user.username}? The account itself stays.`)) return;
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
            <p className="text-sm text-muted-foreground">{user.email}, joined {fmtDate(user.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            {user.tier && user.tier !== "free" && (
              <Badge variant="default">{TIER_LABELS[user.tier] || user.tier}</Badge>
            )}
            {user.role === "admin"
              ? <Badge variant="default">admin</Badge>
              : <Badge variant="secondary">user</Badge>}
          </div>
        </div>
      </div>

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
        </p>
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
