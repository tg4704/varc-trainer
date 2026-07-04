// ② Coach — session summary screen
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coach } from "../api.js";
import TypeBadge from "../components/TypeBadge.jsx";
import { cn } from "../lib/utils.js";

const LETTERS = ["A", "B", "C", "D"];

export default function CoachSummary() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const result = await coach.getSession(sessionId);
        setData(result);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">Loading summary…</div>
  );
  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>
  );
  if (!data) return null;

  const { coachSession, attempts } = data;
  const { passage, questions, readingGrade } = coachSession;
  const correct = attempts.filter((a) => a.is_correct).length;
  const totalAttempted = attempts.length;
  const scored = attempts.filter((a) => a.reasoning_score != null);
  const avgReasoning = scored.length
    ? (scored.reduce((s, a) => s + a.reasoning_score, 0) / scored.length).toFixed(1)
    : "—";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="display text-[32px] leading-none">Session complete</h1>
        {passage.title && <p className="mt-2 muted">{passage.title}</p>}
      </div>

      {/* Reading grade recap */}
      {readingGrade && (
        <div className="glass mb-8 p-4" style={{ borderLeft: "3px solid var(--teal)" }}>
          <span className="eyebrow" style={{ color: "var(--teal)" }}>
            Your reading: {readingGrade.reading_mode?.replace(/-/g, " ")}
          </span>
          <p className="mt-1.5 text-sm text-foreground">{readingGrade.verdict_line}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Score"
          value={`${correct} / ${totalAttempted}`}
          sub="questions correct"
          color={correct >= questions.length * 0.75 ? "var(--green)" : correct >= questions.length * 0.5 ? "var(--amber)" : "var(--red)"}
        />
        <StatCard
          label="Avg reasoning"
          value={avgReasoning === "—" ? avgReasoning : `${avgReasoning}/5`}
          sub="score across questions"
          color={parseFloat(avgReasoning) >= 4 ? "var(--green)" : "var(--text-2)"}
        />
        <StatCard
          label="Words read"
          value={passage.wordCount?.toLocaleString()}
          sub="passage length"
          color="var(--text-2)"
        />
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3 mb-10">
        {questions.map((q, i) => {
          const a = attempts.find((at) => at.question_index === i);
          if (!a) return (
            <div key={q.id} className="glass px-4 py-3">
              <div className="flex items-center gap-2">
                <TypeBadge type={q.type} />
                <span className="text-xs muted">Not attempted</span>
              </div>
            </div>
          );
          return (
            <div key={q.id} className="glass p-4" style={{ borderLeft: `3px solid ${a.is_correct ? "var(--green)" : "var(--red)"}` }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={q.type} />
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={a.is_correct ? { color: "var(--green)", background: "rgba(74,222,128,0.12)" } : { color: "var(--red)", background: "rgba(248,113,113,0.12)" }}
                  >
                    {a.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
                {a.reasoning_score != null && (
                  <span className="text-xs muted flex-none">Reasoning: {a.reasoning_score}/5</span>
                )}
              </div>
              <p className="text-sm text-foreground font-medium mb-2">{q.question}</p>
              <p className="text-xs muted">
                Your answer: {LETTERS[a.selected_option_index]}
                {!a.is_correct && <> · Correct: {LETTERS[a.correct_option_index]}</>}
              </p>
              {a.key_takeaway && (
                <p className="mt-2 text-xs muted italic">&ldquo;{a.key_takeaway}&rdquo;</p>
              )}
              {a.exchange_count > 0 && (
                <p className="mt-1 text-xs muted">Discussed · {a.exchange_count} exchange{a.exchange_count !== 1 ? "s" : ""}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button className="btn btn-primary fx-sheen flex-1" style={{ padding: "14px 22px", fontSize: 15 }} onClick={() => navigate("/coach")}>
          Practice another passage
        </button>
        <button className="btn btn-glass fx-ring flex-1" style={{ padding: "14px 22px", fontSize: 15 }} onClick={() => navigate("/dashboard")}>
          Go to dashboard
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="glass glasscard p-4 text-center">
      <p className="text-xs muted mb-1">{label}</p>
      <p className={cn("mono text-2xl")} style={{ color }}>{value}</p>
      <p className="text-xs muted mt-0.5">{sub}</p>
    </div>
  );
}
