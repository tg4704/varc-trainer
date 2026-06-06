import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
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
            {data ? `${data.total} total` : "—"}
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

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Username</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Email</th>
              <th className="text-left font-medium px-3 py-2">Role</th>
              <th className="text-right font-medium px-3 py-2">Sessions</th>
              <th className="text-right font-medium px-3 py-2">Attempts</th>
              <th className="text-right font-medium px-3 py-2 hidden lg:table-cell">Correct</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Joined</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Last active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.users?.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-6">No users</td></tr>
            )}
            {data?.users?.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">{u.username}</td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2">
                  {u.role === "admin"
                    ? <Badge variant="default">admin</Badge>
                    : <Badge variant="secondary">user</Badge>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{u.sessions}</td>
                <td className="px-3 py-2 text-right tabular-nums">{u.attempts}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">{u.correct}</td>
                <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">{fmtDate(u.created_at)}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{fmtDate(u.lastActivity)}</td>
                <td className="px-3 py-2 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/users/${u.id}`}>View</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
