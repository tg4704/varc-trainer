// ② Coach — passage picker. Replaces the old paste-your-own-article flow:
// Coach now runs on admin-curated passages (with a canonical reading_key) so the
// reading-map grade (the differentiator) has something authoritative to grade against.
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { coach } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { cn } from "../lib/utils.js";

const TOPICS = ["", "economics", "humanities", "philosophy", "science", "social"];

export default function CoachLanding() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [passages, setPassages] = useState(null);
  const [error, setError] = useState(null);
  const [startingId, setStartingId] = useState(null);

  useEffect(() => {
    setPassages(null);
    coach.listPassages(topic)
      .then((r) => setPassages(r.passages))
      .catch((e) => setError(e.message));
  }, [topic]);

  async function start(passageId, activeSessionId) {
    setStartingId(passageId);
    setError(null);
    try {
      if (activeSessionId) {
        navigate(`/coach/practice?sessionId=${activeSessionId}`);
        return;
      }
      const { coachSession } = await coach.createSession(passageId);
      navigate(`/coach/practice?sessionId=${coachSession.id}`, { state: { coachSession } });
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-[34px]">Coach</h1>
          <p className="mt-2 muted leading-relaxed max-w-xl">
            Full CAT-style passages. Map the argument before you see any question — the AI
            grades how you read, not just what you answer. Stuck on a question? Discuss it
            after you see the verdict.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/coach/history">History</Link>
        </Button>
      </div>

      {/* Topic filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors capitalize",
              topic === t
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {t || "All topics"}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {passages === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}

      {passages?.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          No passages available{topic ? ` for "${topic}"` : ""} yet. Check back soon.
        </div>
      )}

      {passages?.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {passages.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="capitalize">{p.topic}</Badge>
                {p.genre && <span className="text-xs text-muted-foreground">{p.genre}</span>}
                {p.completed && <Badge variant="success">Completed</Badge>}
                {p.activeSessionId && !p.completed && <Badge variant="secondary">In progress</Badge>}
              </div>
              <h2 className="font-bold text-foreground mb-1 leading-snug">{p.title || "Untitled passage"}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {p.wordCount?.toLocaleString()} words · {p.questionCount} question{p.questionCount === 1 ? "" : "s"}
              </p>
              <Button
                className="mt-auto"
                disabled={startingId === p.id}
                onClick={() => start(p.id, p.activeSessionId)}
              >
                {startingId === p.id ? "Starting…" : p.activeSessionId ? "Resume →" : "Start →"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
