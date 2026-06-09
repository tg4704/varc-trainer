// Phase 14 — AI Reading Coach: Session summary screen
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { coach } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import { cn } from "../lib/utils.js";
import { BookmarkPlus, Check } from "lucide-react";

const LETTERS = ["A", "B", "C", "D"];

export default function CoachSummary() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);

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
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
      Loading summary…
    </div>
  );
  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>
  );
  if (!data) return null;

  const { coachSession, attempts } = data;
  const correct = attempts.filter((a) => a.is_correct).length;
  const totalAttempted = attempts.length;
  const avgExchanges = totalAttempted
    ? (attempts.reduce((s, a) => s + a.exchange_count, 0) / totalAttempted).toFixed(1)
    : "—";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Session Complete</h1>
        {coachSession.articleTitle && (
          <p className="mt-1 text-muted-foreground">{coachSession.articleTitle}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Score"
          value={`${correct} / ${totalAttempted}`}
          sub="questions correct"
          color={correct >= 3 ? "text-success" : correct >= 2 ? "text-amber-500" : "text-destructive"}
        />
        <StatCard
          label="Avg exchanges"
          value={avgExchanges}
          sub="turns per question"
          color={parseFloat(avgExchanges) <= 2 ? "text-success" : "text-muted-foreground"}
        />
        <StatCard
          label="Words read"
          value={coachSession.wordCount?.toLocaleString()}
          sub="article length"
          color="text-muted-foreground"
        />
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3 mb-10">
        {coachSession.questions.map((q, i) => {
          const a = attempts.find((at) => at.question_index === i);
          if (!a) return (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <TypeBadge type={q.type} />
                <span className="text-xs text-muted-foreground">Not attempted</span>
              </div>
            </div>
          );
          const conversation = a.conversation || [];
          const takeaways = a.key_takeaway ? [a.key_takeaway] : [];
          // Extract key takeaway from final_verdict if not stored separately
          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border bg-card p-4",
                a.is_correct ? "border-success/20" : "border-destructive/20"
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <TypeBadge type={q.type} />
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      a.is_correct ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {a.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-none">
                  {a.exchange_count} exchange{a.exchange_count !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-sm text-foreground font-medium mb-2">{q.question}</p>
              {a.selected_option_index != null && (
                <p className="text-xs text-muted-foreground">
                  Your answer: {LETTERS[a.selected_option_index]}
                  {a.correctIndex != null && !a.is_correct && (
                    <> · Correct: {LETTERS[a.correctIndex]}</>
                  )}
                </p>
              )}
              {a.final_verdict && (
                <details className="mt-2">
                  <summary className="text-xs text-primary cursor-pointer select-none">
                    View tutor's final explanation
                  </summary>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {a.final_verdict}
                  </p>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Save to question bank */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Save to your question bank</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Adds all 4 questions from this article to your personal bank for future practice sessions.
            </p>
          </div>
          <Button
            variant={savedMsg ? "outline" : "secondary"}
            size="sm"
            disabled={saving || !!savedMsg}
            onClick={async () => {
              setSaving(true);
              try {
                const res = await coach.saveToBank(sessionId);
                setSavedMsg(res.message);
              } catch (e) {
                setSavedMsg("Failed to save: " + e.message);
              } finally {
                setSaving(false);
              }
            }}
            className="flex-none"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving…
              </span>
            ) : savedMsg ? (
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-success" />
                Saved
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <BookmarkPlus className="h-3.5 w-3.5" />
                Save questions
              </span>
            )}
          </Button>
        </div>
        {savedMsg && (
          <p className="mt-2 text-xs text-success">{savedMsg}</p>
        )}
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" size="lg" onClick={() => navigate("/coach")}>
          Practice Another Article
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
          Go to Dashboard
        </Button>
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
