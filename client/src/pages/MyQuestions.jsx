import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { myQuestions } from "../api.js";
import { Badge } from "../components/ui/badge.jsx";

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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="display text-[32px] leading-none">My Questions</h1>
          <p className="mt-2 muted text-sm">
            Questions you've added. Active ones appear in your practice sessions alongside the built-in bank.
          </p>
        </div>
        <Link to="/my-questions/new" className="btn btn-primary fx-sheen flex-none">
          + Add question
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data?.questions?.length === 0 && (
        <div className="glass p-12 text-center">
          <div className="text-4xl mb-3">📝</div>
          <h2 className="font-semibold text-foreground">No custom questions yet</h2>
          <p className="mt-1 text-sm muted">
            Add a passage you found, from any source, and practice it in your sessions.
          </p>
          <Link to="/my-questions/new" className="btn btn-primary fx-sheen mt-4 inline-flex">
            Add your first question
          </Link>
        </div>
      )}

      {data?.questions?.length > 0 && (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: "rgba(255,255,255,0.03)" }}>
              <tr>
                <th className="text-left font-medium px-4 py-3 muted">Question</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell muted">Type</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell muted">Topic</th>
                <th className="text-left font-medium px-4 py-3 muted">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.questions.map((q) => (
                <tr key={q.id} style={{ borderTop: "1px solid var(--glass-border-lo)" }}>
                  <td className="px-4 py-3 max-w-sm">
                    <Link to={`/my-questions/${q.id}`} className="fx-underline text-foreground line-clamp-2">
                      {q.question_snippet}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant={q.type}>{q.type}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell capitalize muted">
                    {q.topic}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(q)} className="text-xs" title="Click to toggle">
                      {q.is_active
                        ? <Badge variant="success">Active</Badge>
                        : <Badge variant="secondary">Inactive</Badge>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <Link to={`/my-questions/${q.id}`} className="btn btn-glass fx-ring" style={{ padding: "6px 12px", fontSize: 12 }}>
                        Edit
                      </Link>
                      <button
                        onClick={() => remove(q)}
                        className="text-xs font-medium"
                        style={{ color: "var(--red)", padding: "6px 10px" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
