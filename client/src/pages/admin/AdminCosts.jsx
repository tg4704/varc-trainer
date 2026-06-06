import { useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Card, CardContent } from "../../components/ui/card.jsx";

function fmtUsd(n) {
  if (n == null) return "—";
  if (Math.abs(n) < 0.01) return `$${(n || 0).toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtNum(n) { return (n || 0).toLocaleString(); }

export default function AdminCosts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    admin.costs().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-destructive">{error}</p>;
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const { totals, byDay, byModel, byUser } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Costs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Token usage and estimated USD spend across all AI calls.
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total spend</div>
          <div className="mt-1 text-xl font-bold text-foreground">{fmtUsd(totals.costUsd)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Calls</div>
          <div className="mt-1 text-xl font-bold text-foreground">{fmtNum(totals.calls)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Input tokens</div>
          <div className="mt-1 text-xl font-bold text-foreground">{fmtNum(totals.inputTokens)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Output tokens</div>
          <div className="mt-1 text-xl font-bold text-foreground">{fmtNum(totals.outputTokens)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Errors</div>
          <div className="mt-1 text-xl font-bold text-foreground">{fmtNum(totals.errors)}</div>
        </CardContent></Card>
      </div>

      {/* By day */}
      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Last 30 days</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Day</th>
              <th className="text-right font-medium px-3 py-2">Calls</th>
              <th className="text-right font-medium px-3 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byDay.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">No calls yet</td></tr>
            )}
            {byDay.map(r => (
              <tr key={r.day} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{r.day}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.calls)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* By model */}
      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">By model</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Provider</th>
              <th className="text-left font-medium px-3 py-2">Model</th>
              <th className="text-right font-medium px-3 py-2">Calls</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Input</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Output</th>
              <th className="text-right font-medium px-3 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byModel.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-foreground py-4">No calls yet</td></tr>
            )}
            {byModel.map(r => (
              <tr key={`${r.provider}:${r.model}`} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">{r.provider}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.model}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.calls)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtNum(r.inputTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtNum(r.outputTokens)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* By user */}
      <Card>
        <div className="p-4 border-b border-border text-sm font-semibold">Top users by spend</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">User</th>
              <th className="text-right font-medium px-3 py-2">Calls</th>
              <th className="text-right font-medium px-3 py-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {byUser.length === 0 && (
              <tr><td colSpan={3} className="text-center text-muted-foreground py-4">No data</td></tr>
            )}
            {byUser.map(r => (
              <tr key={r.userId ?? "null"} className="border-t border-border">
                <td className="px-3 py-2">{r.username || <span className="text-muted-foreground">— deleted —</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(r.calls)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtUsd(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
