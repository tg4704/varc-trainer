import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getSession } from "../api.js";
import TypeBadge from "../components/TypeBadge.jsx";
import TopicBadge from "../components/TopicBadge.jsx";

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function Results() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session specified");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setData(await getSession(sessionId));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center muted">
        Loading results…
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>
    );
  }

  const { session, attempts } = data;
  const answered = attempts.filter((a) => a.skipped === 0);
  const correct = answered.filter((a) => a.is_correct === 1).length;
  const skipped = attempts.length - answered.length;
  const trapPicked = answered.filter((a) => a.selected_trap === 1).length;
  const totalTime = attempts.reduce((sum, a) => sum + (a.time_taken_seconds || 0), 0);
  const accuracy = answered.length ? Math.round((correct / answered.length) * 100) : 0;

  const stats = [
    ["Answered", `${answered.length} / ${session.numQuestions}`],
    ["Correct", `${correct}`],
    ["Accuracy", `${accuracy}%`],
    ["Skipped", `${skipped}`],
    ["Trap picks", `${trapPicked}`],
    ["Total time", formatTime(totalTime)],
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="display text-[34px] leading-none">Session complete</h1>
      <p className="mt-2 muted text-sm">Here's how this session went.</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map(([label, value]) => (
          <div key={label} className="glass glasscard p-5">
            <div className="mono text-[26px] leading-none text-foreground">{value}</div>
            <div className="mt-2 text-sm muted">{label}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="eyebrow">Question by question</h2>
        <div className="glass mt-3">
          {attempts.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-3"
              style={i > 0 ? { borderTop: "1px solid var(--glass-border-lo)" } : undefined}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm dim w-6 mono">{i + 1}</span>
                <TypeBadge type={a.question_type} />
                <TopicBadge topic={a.topic} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs mono dim">
                  {formatTime(a.time_taken_seconds)}
                </span>
                <ResultBadge attempt={a} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Link to="/setup" className="btn btn-primary fx-sheen">
          New session
        </Link>
        <Link to="/dashboard" className="btn btn-glass fx-ring">
          View dashboard
        </Link>
      </div>
    </div>
  );
}

function ResultBadge({ attempt }) {
  if (attempt.skipped === 1) {
    return (
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
        Skipped
      </span>
    );
  }
  return attempt.is_correct === 1 ? (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: "var(--green)", background: "rgba(74,222,128,0.12)" }}>
      Correct
    </span>
  ) : (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: "var(--red)", background: "rgba(248,113,113,0.12)" }}>
      Incorrect
    </span>
  );
}
