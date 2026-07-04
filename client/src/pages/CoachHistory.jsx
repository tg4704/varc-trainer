// VARC Coach — History page
// Lists all past coach sessions; in-progress ones can be resumed, completed ones open the summary.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { coach } from "../api.js";
import { getActiveCoachSessionId } from "../coachSession.js";
import { Badge } from "../components/ui/badge.jsx";

function fmtDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CoachHistory() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const activeId = getActiveCoachSessionId();

  useEffect(() => {
    coach.history()
      .then(({ sessions: s }) => setSessions(s))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-destructive">{error}</div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:px-9">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="display text-[32px] leading-none">Coach History</h1>
          <p className="mt-2 muted text-sm">Your past reading coach sessions.</p>
        </div>
        <Link to="/coach" className="btn btn-glass fx-ring flex-none">
          New session
        </Link>
      </div>

      {sessions === null && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-[16px] bg-muted animate-pulse" />)}
        </div>
      )}

      {sessions?.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          No sessions yet.{" "}
          <Link to="/coach" className="fx-underline" style={{ color: "var(--teal)" }}>Start your first one →</Link>
        </div>
      )}

      {sessions?.length > 0 && (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isActive = String(s.id) === String(activeId);
            const isInProgress = s.status !== "completed";
            const score = s.attempted > 0
              ? `${s.correct ?? 0}/${s.attempted} correct`
              : "No answers yet";
            return (
              <div key={s.id} className="glass flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {s.article_title || "Untitled passage"}
                    </span>
                    {isInProgress && (
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "In progress" : "Incomplete"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(s.created_at)} · {score}
                    {s.avg_reasoning_score ? ` · avg reasoning ${Number(s.avg_reasoning_score).toFixed(1)}/5` : ""}
                  </p>
                </div>
                <div className="flex-none">
                  {isInProgress ? (
                    <button
                      className="btn btn-primary fx-sheen"
                      style={{ padding: "8px 14px", fontSize: 13 }}
                      onClick={() => navigate(`/coach/practice?sessionId=${s.id}`)}
                    >
                      Resume
                    </button>
                  ) : (
                    <Link to={`/coach/summary?sessionId=${s.id}`} className="btn btn-glass fx-ring" style={{ padding: "8px 14px", fontSize: 13 }}>
                      Review
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
