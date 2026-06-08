import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { loadActiveSession } from "../session.js";
import { streak as streakApi } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import StreakWidget from "../components/StreakWidget.jsx";

const VALUE_PROPS = [
  {
    title: "Reasoning evaluated, not just answers",
    body: "You explain why you chose an option. The feedback grades how you thought, not only whether you were right.",
  },
  {
    title: "Every trap option deconstructed",
    body: "See exactly why the tempting wrong answer was designed to fool you — and where its logic breaks.",
  },
  {
    title: "Your exact weakness identified",
    body: "Track which question types and trap patterns catch you most, so you can practise the skill you actually lack.",
  },
];

export default function Home() {
  const { user } = useAuth();
  const hasActive = Boolean(loadActiveSession());
  const [streakData, setStreakData] = useState(null);

  useEffect(() => {
    if (!user) return;
    streakApi.get().then(setStreakData).catch(() => {});
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Stop picking the trap option.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
          Most CAT students know the passage. They still pick the wrong answer. This trains the
          skill that fixes that.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          {user ? (
            <>
              <Button asChild size="lg" className="text-base">
                <Link to="/setup">Start Practice</Link>
              </Button>
              {hasActive && (
                <Link
                  to="/practice"
                  className="text-base font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Continue Session
                </Link>
              )}
            </>
          ) : (
            <>
              <Button asChild size="lg" className="text-base">
                <Link to="/register">Get started</Link>
              </Button>
              <Link
                to="/login"
                className="text-base font-medium text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Streak widget — only for logged-in users with data */}
      {user && streakData && (
        <div className="mt-12 max-w-2xl mx-auto">
          <StreakWidget data={streakData} onUpdate={setStreakData} />
        </div>
      )}

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {VALUE_PROPS.map((vp) => (
          <Card key={vp.title}>
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground">{vp.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{vp.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
