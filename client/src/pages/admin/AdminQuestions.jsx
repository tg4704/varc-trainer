import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";

const TYPES = ["", "inference", "tone", "title", "detail", "application"];
const TOPICS = ["", "economics", "humanities", "philosophy", "science", "social"];

export default function AdminQuestions() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [topic, setTopic] = useState("");
  const [active, setActive] = useState("1");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = () => {
    const filters = {};
    if (q) filters.q = q;
    if (type) filters.type = type;
    if (topic) filters.topic = topic;
    if (active) filters.active = active;
    admin.listQuestions(filters).then(setData).catch((e) => setError(e.message));
  };

  useEffect(() => {
    const t = setTimeout(reload, q ? 200 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, type, topic, active]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${data.total} matching` : "—"}
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
          value={active} onChange={(e) => setActive(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Type</th>
              <th className="text-left font-medium px-3 py-2 hidden md:table-cell">Topic</th>
              <th className="text-left font-medium px-3 py-2">Question</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Source</th>
              <th className="text-right font-medium px-3 py-2 hidden lg:table-cell">Attempts</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Flags</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.questions?.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-6">No questions match</td></tr>
            )}
            {data?.questions?.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{q.id}</td>
                <td className="px-3 py-2"><Badge variant={q.type}>{q.type}</Badge></td>
                <td className="px-3 py-2 hidden md:table-cell capitalize text-muted-foreground">{q.topic}</td>
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
