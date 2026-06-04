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
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading results…
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-red-600">{error}</div>
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
      <h1 className="text-2xl font-bold text-slate-900">Session complete</h1>
      <p className="mt-1 text-slate-500">Here's how this session went.</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="mt-1 text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Question by question
        </h2>
        <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {attempts.map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400 w-6">{i + 1}</span>
                <TypeBadge type={a.question_type} />
                <TopicBadge topic={a.topic} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400">
                  {formatTime(a.time_taken_seconds)}
                </span>
                <ResultBadge attempt={a} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <Link
          to="/setup"
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          New session
        </Link>
        <Link
          to="/dashboard"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400"
        >
          View dashboard
        </Link>
      </div>
    </div>
  );
}

function ResultBadge({ attempt }) {
  if (attempt.skipped === 1) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
        Skipped
      </span>
    );
  }
  return attempt.is_correct === 1 ? (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
      Correct
    </span>
  ) : (
    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      Incorrect
    </span>
  );
}
