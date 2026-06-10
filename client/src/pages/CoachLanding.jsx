// Phase 14 — AI Reading Coach: Article input screen
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { coach } from "../api.js";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";

const MIN_WORDS = 0;
const MAX_WORDS = 600;

const LOADING_MESSAGES = [
  "Reading your article…",
  "Identifying key arguments…",
  "Designing CAT-style questions…",
  "Building answer choices…",
  "Almost ready…",
];

const SOURCES = [
  { label: "The Economist", url: "economist.com" },
  { label: "Aeon", url: "aeon.co" },
  { label: "The Atlantic", url: "theatlantic.com" },
  { label: "Nautilus", url: "nautil.us" },
  { label: "Project Syndicate", url: "project-syndicate.org" },
];

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function CoachLanding() {
  const navigate = useNavigate();
  const [articleText, setArticleText] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSource, setArticleSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState(null);

  const wordCount = countWords(articleText);
  const wordOk = wordCount > 0 && wordCount <= MAX_WORDS;

  async function handleGenerate() {
    if (!wordOk || busy) return;
    setBusy(true);
    setError(null);

    // Cycle through loading messages while waiting
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 1800);

    try {
      const { coachSession } = await coach.createSession({
        articleText,
        articleTitle: articleTitle.trim(),
        articleSource: articleSource.trim(),
      });
      clearInterval(msgInterval);
      navigate(`/coach/practice?sessionId=${coachSession.id}`, {
        state: { coachSession },
      });
    } catch (e) {
      clearInterval(msgInterval);
      setError(e.message || "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const wordColor =
    wordCount === 0
      ? "text-muted-foreground"
      : wordCount > MAX_WORDS
      ? "text-destructive"
      : "text-success";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">VARC Coach</h1>
        <p className="mt-1 text-muted-foreground">
          Paste any dense article. VARC Coach generates 4 CAT-style questions, then guides you
          through a structured debrief — like a tutor sitting next to you.
        </p>
      </div>

      {/* Article textarea */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <label className="text-sm font-semibold text-foreground">Article text</label>
          <span className={cn("text-xs tabular-nums", wordColor)}>
            {wordCount} / {MAX_WORDS} words
          </span>
        </div>
        <textarea
          value={articleText}
          onChange={(e) => setArticleText(e.target.value)}
          disabled={busy}
          rows={14}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y font-reading leading-relaxed disabled:opacity-60"
          placeholder="Paste your article here. Up to 600 words. Good sources: The Economist, Aeon, The Atlantic, Nautilus…"
        />
      </section>

      {/* Optional fields */}
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Article title <span className="font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
            placeholder="e.g. The End of the Office"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Source <span className="font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={articleSource}
            onChange={(e) => setArticleSource(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
            placeholder="e.g. The Economist, June 2025"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button
        className="mt-6 w-full"
        size="lg"
        disabled={!wordOk || busy}
        onClick={handleGenerate}
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            {loadingMsg}
          </span>
        ) : wordCount === 0 ? (
          "Paste an article to begin"
        ) : !wordOk ? (
          `Too long — trim to ${MAX_WORDS} words (${wordCount} words)`
        ) : (
          "Generate Questions →"
        )}
      </Button>

      {/* Source guide */}
      <div className="mt-10 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Recommended sources for CAT-level practice
        </h2>
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <span
              key={s.url}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              {s.label}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Avoid news articles (too factual) and Wikipedia (no argument structure). Dense,
          opinion-forward writing works best — like what appears in CAT passages. Aim for
          150–600 words for best results.
        </p>
      </div>
    </div>
  );
}
