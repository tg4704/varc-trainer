// VARC Coach — History page
// Lists all past coach sessions; in-progress ones can be resumed, completed ones open the summary.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { coach } from "../api.js";
import { getActiveCoachSessionId } from "../coachSession.js";
import { Button } from "../components/ui/button.jsx";
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
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">VARC Coach History</h1>
          <p className="mt-1 text-muted-foreground">Your past reading coach sessions.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/coach">New session</Link>
        </Button>
      </div>

      {sessions === null && (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}

      {sessions?.length === 0 && (
        <div className="py-16 text-center text-muted-foreground">
          No sessions yet.{" "}
          <Link to="/coach" className="underline text-foreground">Start your first one →</Link>
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
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {s.article_title || "Untitled article"}
                    </span>
                    {isInProgress && (
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "In progress" : "Incomplete"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(s.created_at)} · {score}
                    {s.avg_exchanges ? ` · avg ${Number(s.avg_exchanges).toFixed(1)} exchanges` : ""}
                  </p>
                </div>
                <div className="flex-none">
                  {isInProgress ? (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/coach/practice?sessionId=${s.id}`)}
                    >
                      Resume
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/coach/summary?sessionId=${s.id}`}>Review</Link>
                    </Button>
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
