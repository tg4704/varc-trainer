import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";

// Compact and unambiguous ("19 Jul 26"). The locale default (19/07/2026) cost
// ~25px per date column, and with two date columns plus a pinned action cell
// this table was overflowing its card.
function fmtDate(s) {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const TIER_LABELS = {
  free: "Skimmer",
  inference: "Inference",
  ninetyninth: "99th",
  topper: "Topper",
};

// A tier whose expiry has passed is NOT the plan the user actually has - the
// server collapses it to free at request time (effectiveTierKey). Showing the
// stale users.tier value here would make an admin think someone still has
// Topper when they were downgraded weeks ago, so we apply the same rule.
function planFor(u) {
  const key = u.tier || "free";
  const expired = u.tierExpiresAt && new Date(u.tierExpiresAt) < new Date();
  if (key === "free" || expired) {
    return { label: TIER_LABELS.free, paid: false, note: expired ? `expired ${fmtDate(u.tierExpiresAt)}` : null };
  }
  return {
    label: TIER_LABELS[key] || key,
    paid: true,
    note: u.tierExpiresAt ? `till ${fmtDate(u.tierExpiresAt)}` : null,
  };
}

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      admin.listUsers({ q, page, pageSize: 50 }).then(setData).catch((e) => setError(e.message));
    }, q ? 200 : 0); // debounce search
    return () => clearTimeout(t);
  }, [q, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} total` : "-"}
          </p>
        </div>
        <Input
          placeholder="Search username or email…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="w-64"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* The card used to clip (overflow-hidden) a table wider than it: at
          10 columns the right-hand action cell was simply cut off the page
          with no way to scroll to it. Same overflow-x-auto treatment the
          other wide admin tables (/admin/logs, /admin/costs) already use. */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Username</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Email</th>
              <th className="text-left font-medium px-3 py-2">Role</th>
              <th className="text-left font-medium px-3 py-2">Plan</th>
              <th className="text-right font-medium px-2 py-2" title="Sessions">Sess.</th>
              <th className="text-right font-medium px-2 py-2" title="Attempts">Att.</th>
              <th className="text-right font-medium px-2 py-2 hidden xl:table-cell" title="Correct answers">Corr.</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell whitespace-nowrap">Joined</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell whitespace-nowrap">Last active</th>
              {/* Pinned to the right edge: the actions are the point of the
                  row, so they must not depend on the user discovering that
                  the table scrolls sideways. */}
              <th className="sticky right-0 bg-muted px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.users?.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-6">No users</td></tr>
            )}
            {data?.users?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">{u.username}</td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                  <span className="block max-w-[190px] truncate" title={u.email}>{u.email}</span>
                </td>
                <td className="px-3 py-2">
                  {u.role === "admin"
                    ? <Badge variant="default">admin</Badge>
                    : <Badge variant="secondary">user</Badge>}
                </td>
                <td className="px-3 py-2">
                  {(() => {
                    const plan = planFor(u);
                    return (
                      <div className="flex flex-col leading-tight">
                        <span className={plan.paid ? "font-medium text-foreground" : "text-muted-foreground"}>
                          {plan.label}
                        </span>
                        {plan.note && <span className="text-[11px] text-muted-foreground">{plan.note}</span>}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{u.sessions}</td>
                <td className="px-2 py-2 text-right tabular-nums">{u.attempts}</td>
                <td className="px-2 py-2 text-right tabular-nums hidden xl:table-cell">{u.correct}</td>
                <td className="px-3 py-2 hidden md:table-cell whitespace-nowrap text-muted-foreground">{fmtDate(u.created_at)}</td>
                <td className="px-3 py-2 hidden lg:table-cell whitespace-nowrap text-muted-foreground">{fmtDate(u.lastActivity)}</td>
                <td className="sticky right-0 bg-card px-3 py-2 text-right">
                  <div className="flex justify-end gap-2 whitespace-nowrap">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/admin/users/${u.id}`}>View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/admin/users/${u.id}?edit=1`}>Edit</Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Page {data.page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
