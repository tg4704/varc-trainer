// ② Coach — session summary screen
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coach } from "../api.js";
import { Button } from "../components/ui/button.jsx";
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
        <h1 className="text-2xl font-bold text-foreground">Session Complete</h1>
        {passage.title && <p className="mt-1 text-muted-foreground">{passage.title}</p>}
      </div>

      {/* Reading grade recap */}
      {readingGrade && (
        <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            Your reading: {readingGrade.reading_mode?.replace(/-/g, " ")}
          </span>
          <p className="mt-1 text-sm text-foreground">{readingGrade.verdict_line}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Score"
          value={`${correct} / ${totalAttempted}`}
          sub="questions correct"
          color={correct >= questions.length * 0.75 ? "text-success" : correct >= questions.length * 0.5 ? "text-amber-500" : "text-destructive"}
        />
        <StatCard
          label="Avg reasoning"
          value={avgReasoning === "—" ? avgReasoning : `${avgReasoning}/5`}
          sub="score across questions"
          color={parseFloat(avgReasoning) >= 4 ? "text-success" : "text-muted-foreground"}
        />
        <StatCard
          label="Words read"
          value={passage.wordCount?.toLocaleString()}
          sub="passage length"
          color="text-muted-foreground"
        />
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3 mb-10">
        {questions.map((q, i) => {
          const a = attempts.find((at) => at.question_index === i);
          if (!a) return (
            <div key={q.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <TypeBadge type={q.type} />
                <span className="text-xs text-muted-foreground">Not attempted</span>
              </div>
            </div>
          );
          return (
            <div key={q.id} className={cn("rounded-xl border bg-card p-4", a.is_correct ? "border-success/20" : "border-destructive/20")}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={q.type} />
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", a.is_correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {a.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
                {a.reasoning_score != null && (
                  <span className="text-xs text-muted-foreground flex-none">Reasoning: {a.reasoning_score}/5</span>
                )}
              </div>
              <p className="text-sm text-foreground font-medium mb-2">{q.question}</p>
              <p className="text-xs text-muted-foreground">
                Your answer: {LETTERS[a.selected_option_index]}
                {!a.is_correct && <> · Correct: {LETTERS[a.correct_option_index]}</>}
              </p>
              {a.key_takeaway && (
                <p className="mt-2 text-xs text-muted-foreground italic">"{a.key_takeaway}"</p>
              )}
              {a.exchange_count > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Discussed · {a.exchange_count} exchange{a.exchange_count !== 1 ? "s" : ""}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" size="lg" onClick={() => navigate("/coach")}>Practice Another Passage</Button>
        <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", color)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
