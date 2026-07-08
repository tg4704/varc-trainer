import { useEffect, useState } from "react";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";

// A passage row gates whether it appears in the Coach picker at all — separate
// from activating its individual questions (Admin → Questions). Imported passages
// land inactive; activate here once you've reviewed the passage + its questions.
export default function AdminPassages() {
  const [active, setActive] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const reload = () => {
    admin.listPassages(active).then(setData).catch((e) => setError(e.message));
  };

  useEffect(reload, [active]);

  async function toggle(p) {
    setBusyId(p.id);
    try {
      await admin.setPassageActive(p.id, !p.is_active);
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Passages (② Coach)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} matching` : "—"}. Activating a passage here is what makes it
            appear in the Coach picker — separate from activating its questions.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={active} onChange={(e) => setActive(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Title</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Topic</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Source</th>
              <th className="text-right font-medium px-3 py-2">Questions</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.passages?.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">No passages match</td></tr>
            )}
            {data?.passages?.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.id}</td>
                <td className="px-3 py-2 max-w-sm truncate text-foreground">{p.title || "(untitled)"}</td>
                <td className="px-3 py-2 hidden md:table-cell capitalize text-muted-foreground">{p.topic}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{p.source}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.activeQuestionCount} / {p.questionCount} active
                </td>
                <td className="px-3 py-2">
                  {p.is_active ? <Badge variant="success">active</Badge> : <Badge variant="secondary">off</Badge>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="outline" size="sm" disabled={busyId === p.id} onClick={() => toggle(p)}>
                    {p.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
