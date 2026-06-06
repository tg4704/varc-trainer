import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { myQuestions } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Card } from "../components/ui/card.jsx";

export default function MyQuestions() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = () =>
    myQuestions.list().then(setData).catch((e) => setError(e.message));

  useEffect(() => { reload(); }, []);

  async function toggleActive(q) {
    try {
      await myQuestions.update(q.id, { isActive: !q.is_active });
      reload();
    } catch (e) { setError(e.message); }
  }

  async function remove(q) {
    if (!confirm(`Delete "${q.question_snippet.slice(0, 60)}…"? This cannot be undone.`)) return;
    try {
      await myQuestions.remove(q.id);
      reload();
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Questions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions you've added. Active ones appear in your practice sessions alongside the built-in bank.
          </p>
        </div>
        <Button asChild>
          <Link to="/my-questions/new">+ Add question</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.questions?.length === 0 && (
        <Card>
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="font-semibold text-foreground">No custom questions yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a passage you found — from The Economist, Aeon, anywhere — and practice it in your sessions.
            </p>
            <Button asChild className="mt-4">
              <Link to="/my-questions/new">Add your first question</Link>
            </Button>
          </div>
        </Card>
      )}

      {data?.questions?.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Question</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Type</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Topic</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.questions.map((q) => (
                <tr key={q.id} className="border-t border-border">
                  <td className="px-4 py-3 max-w-sm">
                    <Link
                      to={`/my-questions/${q.id}`}
                      className="text-foreground hover:text-primary line-clamp-2"
                    >
                      {q.question_snippet}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant={q.type}>{q.type}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell capitalize text-muted-foreground">
                    {q.topic}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(q)}
                      className="text-xs"
                      title="Click to toggle"
                    >
                      {q.is_active
                        ? <Badge variant="success">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/my-questions/${q.id}`}>Edit</Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(q)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
