import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";
import BulkActionBar, { RowCheckbox } from "../../components/admin/BulkActionBar.jsx";
import { Select } from "../../components/ui/select.jsx";

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-");

// Coach = full-RC passages. Activating a passage here activates its questions
// alongside it (and deactivating deactivates them). Open a passage to edit it
// and manage its questions. Imported passages land inactive for review.
export default function AdminPassages() {
  const [active, setActive] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState([]);

  const reload = () => {
    admin.listPassages(active).then(setData).catch((e) => setError(e.message));
  };

  useEffect(() => {
    setSelected([]);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

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

  const rows = data?.passages ?? [];
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggleRow = (id, on) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coach</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} passage${data.total === 1 ? "" : "s"}` : "-"}. Activating a passage
            activates its questions too; open one to edit the passage and its questions.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={active} onChange={setActive} className="w-40"
          options={[{ value: "", label: "All" }, { value: "1", label: "Active" }, { value: "0", label: "Inactive" }]}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <BulkActionBar
        noun="passage"
        selected={selected}
        onClear={() => setSelected([])}
        onRun={async (action) => {
          await admin.bulkPassages(selected, action);
          setSelected([]);
          reload();
        }}
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-8">
                <RowCheckbox
                  label="Select all passages"
                  checked={allSelected}
                  indeterminate={selected.length > 0 && !allSelected}
                  onChange={(on) => setSelected(on ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Title</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Topic</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Source</th>
              <th className="text-right font-medium px-3 py-2">Questions</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Added</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-6">No passages match</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-3 py-2">
                  <RowCheckbox
                    label={`Select passage ${p.id}`}
                    checked={selected.includes(p.id)}
                    onChange={(on) => toggleRow(p.id, on)}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p.id}</td>
                <td className="px-3 py-2 max-w-sm truncate">
                  <Link to={`/admin/passages/${p.id}`} className="text-foreground hover:underline font-medium">
                    {p.title || "(untitled)"}
                  </Link>
                </td>
                <td className="px-3 py-2 hidden md:table-cell capitalize text-muted-foreground">{p.topic}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{p.source}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.activeQuestionCount} / {p.questionCount} active
                </td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground whitespace-nowrap">{fmtDate(p.created_at)}</td>
                <td className="px-3 py-2">
                  {p.is_active ? <Badge variant="success">active</Badge> : <Badge variant="secondary">off</Badge>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/admin/passages/${p.id}`}>Open</Link>
                  </Button>
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
