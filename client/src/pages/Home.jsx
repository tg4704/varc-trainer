import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { loadActiveSession } from "../session.js";

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

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900">
          Stop picking the trap option.
        </h1>
        <p className="mt-5 text-lg text-slate-600 leading-relaxed">
          Most CAT students know the passage. They still pick the wrong answer. This trains the
          skill that fixes that.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4">
          {user ? (
            <>
              <Link
                to="/setup"
                className="inline-flex items-center rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-700 transition-colors"
              >
                Start Practice
              </Link>
              {hasActive && (
                <Link
                  to="/practice"
                  className="text-base font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4"
                >
                  Continue Session
                </Link>
              )}
            </>
          ) : (
            <>
              <Link
                to="/register"
                className="inline-flex items-center rounded-lg bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-slate-700 transition-colors"
              >
                Get started
              </Link>
              <Link
                to="/login"
                className="text-base font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        {VALUE_PROPS.map((vp) => (
          <div key={vp.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900">{vp.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{vp.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
