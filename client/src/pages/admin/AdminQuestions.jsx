import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";
import BulkActionBar, { RowCheckbox } from "../../components/admin/BulkActionBar.jsx";

const TYPES = [
  "", "inference", "main_idea", "function", "tone", "detail", "application",
  "concept_set", "vocab_in_context", "weaken_strengthen", "title",
];
const TOPICS = ["", "economics", "humanities", "philosophy", "science", "social"];
// passage_id NULL = ③ Drills, set = ② Coach - see questionsRepo.js.
const PRODUCTS = [
  { value: "", label: "All products" },
  { value: "drills", label: "Drills only" },
  { value: "coach", label: "Coach only" },
];

export default function AdminQuestions() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [topic, setTopic] = useState("");
  const [active, setActive] = useState("1");
  const [product, setProduct] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);

  const reload = () => {
    const filters = {};
    if (q) filters.q = q;
    if (type) filters.type = type;
    if (topic) filters.topic = topic;
    if (active) filters.active = active;
    if (product) filters.product = product;
    admin.listQuestions(filters).then(setData).catch((e) => setError(e.message));
  };

  // Filters changing swaps out which rows are on screen, so any prior selection
  // would be invisible-but-live - drop it rather than act on rows nobody can see.
  useEffect(() => {
    setSelected([]);
    const t = setTimeout(reload, q ? 200 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, topic, active, product]);

  const rows = data?.questions ?? [];
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const toggleRow = (id, on) =>
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} matching` : "-"}
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/questions/new">+ New question</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search question or paragraph…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
        <select
          value={type} onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {TYPES.map(t => <option key={t} value={t}>{t || "All types"}</option>)}
        </select>
        <select
          value={topic} onChange={(e) => setTopic(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {TOPICS.map(t => <option key={t} value={t}>{t || "All topics"}</option>)}
        </select>
        <select
          value={product} onChange={(e) => setProduct(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {PRODUCTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <select
          value={active} onChange={(e) => setActive(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <BulkActionBar
        noun="question"
        selected={selected}
        onClear={() => setSelected([])}
        onRun={async (action) => {
          await admin.bulkQuestions(selected, action);
          setSelected([]);
          reload();
        }}
      />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 w-8">
                <RowCheckbox
                  label="Select all questions"
                  checked={allSelected}
                  indeterminate={selected.length > 0 && !allSelected}
                  onChange={(on) => setSelected(on ? rows.map((r) => r.id) : [])}
                />
              </th>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Type</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Topic</th>
              <th className="text-left font-medium px-3 py-2">Product</th>
              <th className="text-left font-medium px-3 py-2">Question</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Source</th>
              <th className="text-right font-medium px-3 py-2 hidden lg:table-cell">Attempts</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Flags</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={11} className="text-center text-muted-foreground py-6">No questions match</td></tr>
            )}
            {rows.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <RowCheckbox
                    label={`Select question ${q.id}`}
                    checked={selected.includes(q.id)}
                    onChange={(on) => toggleRow(q.id, on)}
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{q.id}</td>
                <td className="px-3 py-2"><Badge variant={q.type}>{q.type}</Badge></td>
                <td className="px-3 py-2 hidden md:table-cell capitalize text-muted-foreground">{q.topic}</td>
                <td className="px-3 py-2">
                  {q.passageId ? (
                    <span title={q.passageTitle ? `Passage: ${q.passageTitle}` : `Passage #${q.passageId}`}>
                      <Badge variant="secondary">Coach</Badge>
                    </span>
                  ) : (
                    <Badge variant="outline">Drills</Badge>
                  )}
                </td>
                <td className="px-3 py-2 max-w-md truncate text-foreground">{q.question_snippet}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground">{q.source}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell">{q.attempts}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">
                  {q.openFlags > 0 ? <Badge variant="warning">{q.openFlags}</Badge> : <span className="text-muted-foreground">0</span>}
                </td>
                <td className="px-3 py-2">
                  {q.is_active
                    ? <Badge variant="success">active</Badge>
                    : <Badge variant="secondary">off</Badge>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/questions/${q.id}`}>Edit</Link>
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
