import { useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-");

// Days left before the daily sweep hard-purges a trashed row.
function daysLeft(deletedAt, ttl) {
  if (!deletedAt) return ttl;
  const purgeAt = new Date(deletedAt).getTime() + ttl * 86400000;
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / 86400000));
}

export default function AdminTrash() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const reload = () => admin.listTrash().then(setData).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, []);

  async function act(fn, kind, id, key) {
    setBusy(key); setError(null);
    try { await fn(kind, id); reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }

  if (error && !data) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const ttl = data.ttlDays;
  const restore = (kind, id, key) => act(admin.restoreTrash, kind, id, key);
  const purge = (kind, id, key) => {
    if (!window.confirm("Permanently delete this now? This cannot be undone.")) return;
    return act(admin.purgeTrash, kind, id, key);
  };

  const DaysBadge = ({ deletedAt }) => {
    const d = daysLeft(deletedAt, ttl);
    return <Badge variant={d <= 2 ? "warning" : "secondary"}>{d} day{d === 1 ? "" : "s"} left</Badge>;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Deleted</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleted drills and passages are kept here and permanently removed {ttl} days after deletion.
          Restore brings an item back (inactive). Passages with Coach history can't be purged.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Passages */}
      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b border-border font-semibold text-foreground">
          Passages ({data.passages.length})
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Title</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Topic</th>
              <th className="text-right font-medium px-3 py-2">Questions</th>
              <th className="text-left font-medium px-3 py-2">Deleted</th>
              <th className="text-left font-medium px-3 py-2">Purge in</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.passages.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Empty</td></tr>
            )}
            {data.passages.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.id}</td>
                <td className="px-3 py-2 max-w-sm truncate text-foreground">{p.title || "(untitled)"}</td>
                <td className="px-3 py-2 hidden md:table-cell capitalize text-muted-foreground">{p.topic}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.questionCount}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(p.deleted_at)}</td>
                <td className="px-3 py-2"><DaysBadge deletedAt={p.deleted_at} /></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button variant="outline" size="sm" disabled={busy === `p${p.id}`}
                    onClick={() => restore("passages", p.id, `p${p.id}`)}>Restore</Button>
                  <Button variant="destructive" size="sm" className="ml-2"
                    disabled={busy === `p${p.id}` || p.hasCoachHistory}
                    title={p.hasCoachHistory ? "Has Coach sessions — can't be purged" : ""}
                    onClick={() => purge("passages", p.id, `p${p.id}`)}>Purge</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Drills */}
      <Card className="overflow-x-auto">
        <div className="px-4 py-3 border-b border-border font-semibold text-foreground">
          Drills ({data.questions.length})
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Type</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Topic</th>
              <th className="text-left font-medium px-3 py-2">Question</th>
              <th className="text-left font-medium px-3 py-2">Deleted</th>
              <th className="text-left font-medium px-3 py-2">Purge in</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.questions.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">Empty</td></tr>
            )}
            {data.questions.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{q.id}</td>
                <td className="px-3 py-2"><Badge variant={q.type}>{q.type}</Badge></td>
                <td className="px-3 py-2 hidden md:table-cell capitalize text-muted-foreground">{q.topic}</td>
                <td className="px-3 py-2 max-w-md truncate text-foreground">{q.question_snippet}</td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(q.deleted_at)}</td>
                <td className="px-3 py-2"><DaysBadge deletedAt={q.deleted_at} /></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button variant="outline" size="sm" disabled={busy === `q${q.id}`}
                    onClick={() => restore("questions", q.id, `q${q.id}`)}>Restore</Button>
                  <Button variant="destructive" size="sm" className="ml-2" disabled={busy === `q${q.id}`}
                    onClick={() => purge("questions", q.id, `q${q.id}`)}>Purge</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
