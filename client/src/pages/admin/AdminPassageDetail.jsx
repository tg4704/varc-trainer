import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { admin } from "../../api.js";
import { Button } from "../../components/ui/button.jsx";
import { Input, Textarea } from "../../components/ui/input.jsx";
import { Badge } from "../../components/ui/badge.jsx";
import { Card } from "../../components/ui/card.jsx";
import { Select } from "../../components/ui/select.jsx";

const TOPICS = ["economics", "history", "humanities", "philosophy", "science", "social"];
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-");

export default function AdminPassageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    admin.getPassage(id)
      .then((d) => {
        setData(d);
        setForm({
          topic: d.passage.topic || "",
          genre: d.passage.genre || "",
          title: d.passage.title || "",
          body: d.passage.body || "",
        });
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data || !form) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const p = data.passage;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function savePassage() {
    setSaving(true); setNotice(null); setError(null);
    try {
      const res = await admin.savePassage(id, form);
      setNotice(`Saved (${res.wordCount} words).`);
      reload();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function toggleActive() {
    setBusy(true); setNotice(null); setError(null);
    try {
      const res = await admin.setPassageActive(id, !p.is_active);
      setNotice(
        p.is_active
          ? `Passage deactivated (${res.affectedQuestions} question(s) also deactivated).`
          : `Passage activated (${res.affectedQuestions} question(s) also activated).`
      );
      reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function trashPassage() {
    if (!window.confirm("Move this passage and its questions to the Deleted section? They'll be purged after 10 days.")) return;
    setBusy(true);
    try {
      await admin.bulkPassages([Number(id)], "delete");
      navigate("/admin/passages");
    } catch (e) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link to="/admin/passages" className="text-sm text-muted-foreground hover:underline">← Coach</Link>
          <h1 className="text-2xl font-bold text-foreground mt-1">{p.title || "(untitled passage)"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            #{p.id} · {p.source} · added {fmtDate(p.created_at)} ·{" "}
            {p.is_active ? <Badge variant="success">active</Badge> : <Badge variant="secondary">off</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={toggleActive}>
            {p.is_active ? "Deactivate" : "Activate"} (+ questions)
          </Button>
          <Button variant="destructive" disabled={busy} onClick={trashPassage}>Delete</Button>
        </div>
      </div>

      {notice && <p className="text-sm text-emerald-500">{notice}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Passage edit form */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-foreground">Passage</h2>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Topic</span>
            <Select value={form.topic} onChange={(v) => set("topic", v)} options={TOPICS} className="w-48" />
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Genre</span>
            <Input value={form.genre} onChange={(e) => set("genre", e.target.value)} className="w-48" />
          </label>
          <label className="text-sm flex-1 min-w-[200px]">
            <span className="block text-muted-foreground mb-1">Title</span>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </label>
        </div>
        <label className="text-sm block">
          <span className="block text-muted-foreground mb-1">Body (paragraphs separated by blank lines)</span>
          <Textarea rows={14} value={form.body} onChange={(e) => set("body", e.target.value)} className="font-reading" />
        </label>
        <div className="flex justify-end">
          <Button disabled={saving} onClick={savePassage}>{saving ? "Saving…" : "Save passage"}</Button>
        </div>
      </Card>

      {/* Questions */}
      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Questions ({data.questions.length})</h2>
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">ID</th>
              <th className="text-left font-medium px-3 py-2">Type</th>
              <th className="text-left font-medium px-3 py-2">Question</th>
              <th className="text-left font-medium px-3 py-2 hidden lg:table-cell">Added</th>
              <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Attempts</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {data.questions.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-6">No questions on this passage</td></tr>
            )}
            {data.questions.map((q) => (
              <tr key={q.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{q.id}</td>
                <td className="px-3 py-2"><Badge variant={q.type}>{q.type}</Badge></td>
                <td className="px-3 py-2 max-w-md truncate text-foreground">{q.question_snippet}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-muted-foreground whitespace-nowrap">{fmtDate(q.created_at)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{q.attempts}</td>
                <td className="px-3 py-2">
                  {q.is_active ? <Badge variant="success">active</Badge> : <Badge variant="secondary">off</Badge>}
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
