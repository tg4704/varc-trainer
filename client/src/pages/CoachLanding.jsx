// ② Coach - passage picker. Replaces the old paste-your-own-article flow:
// Coach now runs on admin-curated passages (with a canonical reading_key) so the
// reading-map grade (the differentiator) has something authoritative to grade against.
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { coach } from "../api.js";
import { track } from "../analytics.js";
import { Badge } from "../components/ui/badge.jsx";
import { cn } from "../lib/utils.js";
import SideDock from "../components/SideDock.jsx";

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
        track("coach_used", { resumed: true });
        navigate(`/coach/practice?sessionId=${activeSessionId}`);
        return;
      }
      const { coachSession } = await coach.createSession(passageId);
      track("coach_used", { resumed: false });
      navigate(`/coach/practice?sessionId=${coachSession.id}`, { state: { coachSession } });
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 md:px-9">
      <SideDock />
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="display text-[34px]">Coach</h1>
          <p className="mt-2 muted leading-relaxed max-w-xl">
            Full CAT-style passages. Map the argument before you see any question, and the AI
            grades how you read, not just what you answer. Stuck on a question? Discuss it
            after you see the verdict.
          </p>
        </div>
        <Link to="/coach/history" className="btn btn-glass fx-ring flex-none">
          History
        </Link>
      </div>

      {/* Topic filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TOPICS.map((t) => (
          <button
            key={t}
            onClick={() => setTopic(t)}
            className="fx-ring rounded-[10px] px-3.5 py-1.5 text-sm font-medium capitalize transition-colors"
            style={
              topic === t
                ? { background: "var(--teal)", color: "#07130E", border: "1px solid var(--teal)" }
                : { background: "rgba(255,255,255,0.03)", color: "var(--text-2)", border: "1px solid var(--border)" }
            }
          >
            {t || "All topics"}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-[10px] px-3 py-2 text-sm text-destructive" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
          {error}
        </p>
      )}

      {passages === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-[16px] bg-muted animate-pulse" />)}
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
            <div key={p.id} className="glass glasscard flex flex-col p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="capitalize">{p.topic}</Badge>
                {p.genre && <span className="text-xs text-muted-foreground">{p.genre}</span>}
                {p.completed && <Badge variant="success">Completed</Badge>}
                {p.activeSessionId && !p.completed && <Badge variant="secondary">In progress</Badge>}
              </div>
              <h2 className="font-bold text-foreground mb-1 leading-snug">{p.title || "Untitled passage"}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {p.wordCount?.toLocaleString()} words, {p.questionCount} question{p.questionCount === 1 ? "" : "s"}
              </p>
              <button
                className={cn("btn btn-primary fx-sheen mt-auto", startingId === p.id && "opacity-60")}
                disabled={startingId === p.id}
                onClick={() => start(p.id, p.activeSessionId)}
              >
                {startingId === p.id ? "Starting…" : p.activeSessionId ? "Resume →" : "Start →"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
