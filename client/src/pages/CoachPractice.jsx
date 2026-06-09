// Phase 14 — AI Reading Coach: 3-panel practice screen
// Left: article (with source-line highlight after debrief)
// Right top: question + options
// Right bottom: Socratic chat (appears after option selected)
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import OptionCard from "../components/OptionCard.jsx";
import TypeBadge from "../components/TypeBadge.jsx";
import VoiceMicButton from "../components/VoiceMicButton.jsx";
import { Button } from "../components/ui/button.jsx";
import { cn } from "../lib/utils.js";
import { coach } from "../api.js";
import { useVoiceInput } from "../hooks/useVoiceInput.js";

const LETTERS = ["A", "B", "C", "D"];
const MAX_EXCHANGE = 4;
const MAX_MSG_LENGTH = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ArticleWithHighlight({ text, sourceLines }) {
  // Guard: render plain text if no highlight needed, or if text is missing.
  if (!sourceLines || !text) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: "15px", lineHeight: 1.9 }}>
      {text || ""}
    </p>
  );
  const idx = text.indexOf(sourceLines.slice(0, 40));
  if (idx === -1) return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: "15px", lineHeight: 1.9 }}>
      {text}
    </p>
  );
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + sourceLines.length);
  const after = text.slice(idx + sourceLines.length);
  return (
    <p className="font-reading text-foreground whitespace-pre-wrap" style={{ fontSize: "15px", lineHeight: 1.9 }}>
      {before}
      <mark className="bg-amber-200 dark:bg-amber-900/60 rounded px-0.5">{match}</mark>
      {after}
    </p>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoachPractice() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = params.get("sessionId");

  const [coachSession, setCoachSession] = useState(location.state?.coachSession || null);
  const [loading, setLoading] = useState(!location.state?.coachSession);
  const [error, setError] = useState(null);

  // Per-question state
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);

  // Debrief state
  const [debriefPhase, setDebriefPhase] = useState("idle"); // idle | active | complete
  const [conversation, setConversation] = useState([]); // [{ role, text }]
  const [exchangeCount, setExchangeCount] = useState(0);
  const [verdict, setVerdict] = useState(null); // { correctIndex, trapIndex, trapType, sourceLines, isCorrect }

  // Chat input
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const chatEndRef = useRef(null);

  // Voice input for Socratic chat
  const [voiceInterim, setVoiceInterim] = useState("");
  const { isRecording: voiceRecording, isSupported: voiceSupported, toggle: voiceToggle, stop: voiceStop } =
    useVoiceInput({
      onFinalTranscript: (text) => {
        setInputText((prev) => (prev ? prev + " " + text : text));
      },
      onInterimTranscript: (text) => setVoiceInterim(text),
    });

  // Load session if navigated directly (not from landing)
  useEffect(() => {
    if (coachSession || !sessionId) return;
    (async () => {
      try {
        const { coachSession: s } = await coach.getSession(sessionId);
        setCoachSession(s);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, coachSession]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const question = coachSession?.questions?.[qIdx];

  // ── Start debrief (exchange 1 — tutor opens with probe) ──────────────────────
  const startDebrief = useCallback(async () => {
    if (selected === null || !coachSession || sending) return;
    setSending(true);
    setDebriefPhase("active");
    try {
      const data = await coach.exchange({
        coachSessionId: coachSession.id,
        questionIndex: qIdx,
        selectedOptionIndex: selected,
        message: "",
      });
      setConversation([{ role: "tutor", text: data.tutorMessage }]);
      setExchangeCount(1);
      if (data.isComplete) {
        setVerdict(data);
        setDebriefPhase("complete");
      }
    } catch (e) {
      setError(e.message);
      setDebriefPhase("idle");
    } finally {
      setSending(false);
    }
  }, [selected, coachSession, qIdx, sending]);

  // ── Send a student message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (giveUp = false) => {
    if (!coachSession || sending) return;
    if (!giveUp && (!inputText.trim() || inputText.trim().length > MAX_MSG_LENGTH)) return;
    setSending(true);
    const msgToSend = giveUp ? "" : inputText.trim();
    const newConv = giveUp
      ? [...conversation, { role: "student", text: "I give up — show me the answer." }]
      : [...conversation, { role: "student", text: msgToSend }];
    setConversation(newConv);
    setInputText("");
    try {
      const data = await coach.exchange({
        coachSessionId: coachSession.id,
        questionIndex: qIdx,
        selectedOptionIndex: selected,
        message: msgToSend,
        giveUp,
      });
      setConversation([...newConv, { role: "tutor", text: data.tutorMessage }]);
      setExchangeCount(data.exchangeNumber);
      if (data.isComplete) {
        setVerdict(data);
        setDebriefPhase("complete");
      }
    } catch (e) {
      setError(e.message);
      // Remove the optimistically-added student message
      setConversation(conversation);
      setInputText(msgToSend);
    } finally {
      setSending(false);
    }
  }, [coachSession, sending, inputText, conversation, qIdx, selected]);

  // ── Move to next question ─────────────────────────────────────────────────────
  function nextQuestion() {
    voiceStop();
    setVoiceInterim("");
    if (qIdx >= 3) {
      navigate(`/coach/summary?sessionId=${coachSession.id}`);
      return;
    }
    setQIdx((i) => i + 1);
    setSelected(null);
    setDebriefPhase("idle");
    setConversation([]);
    setExchangeCount(0);
    setVerdict(null);
    setInputText("");
    setError(null);
  }

  // ── Render guards ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
      Loading session…
    </div>
  );
  if (error && !coachSession) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-destructive">{error}</p>
      <Button className="mt-4" onClick={() => navigate("/coach")}>Back to Coach</Button>
    </div>
  );
  if (!coachSession || !question) return null;

  const isLastQuestion = qIdx === 3;
  const tutorMessagesSent = conversation.filter((m) => m.role === "tutor").length;
  const canGiveUp = debriefPhase === "active" && exchangeCount < MAX_EXCHANGE && !sending;

  // ── Layout ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Progress bar */}
      <div className="mb-4 flex items-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < qIdx ? "bg-primary" : i === qIdx ? "bg-primary/40" : "bg-border"
            )}
          />
        ))}
        <span className="text-xs text-muted-foreground flex-none">
          Q{qIdx + 1} / 4
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left: Article ────────────────────────────────────────────── */}
        <div className="lg:w-[45%]">
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border bg-card p-5">
            {coachSession.articleTitle && (
              <h2 className="mb-3 font-bold text-foreground text-base leading-snug">
                {coachSession.articleTitle}
              </h2>
            )}
            {coachSession.articleSource && (
              <p className="mb-4 text-xs text-muted-foreground">{coachSession.articleSource}</p>
            )}
            <ArticleWithHighlight
              text={coachSession.articleText}
              sourceLines={verdict?.sourceLines || null}
            />
          </div>
        </div>

        {/* ── Right: Question + Options + Chat ─────────────────────────── */}
        <div className="lg:w-[55%] flex flex-col gap-5">
          {/* Question card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              {/* Type badge hidden until debrief complete — reveals with answer */}
              {verdict
                ? <TypeBadge type={question.type} />
                : <span className="text-xs text-transparent select-none">·</span>
              }
              {debriefPhase === "active" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Exchange {exchangeCount} / {MAX_EXCHANGE}
                </span>
              )}
            </div>
            <h2 className="font-bold text-foreground mb-4" style={{ fontSize: "16px" }}>
              {question.question}
            </h2>
            <div className="space-y-2">
              {question.options.map((opt, i) => {
                let status = null;
                if (verdict) {
                  if (i === verdict.correctIndex) status = selected === i ? "correct" : "correct-unselected";
                  else if (i === selected) status = "wrong";
                }
                return (
                  <OptionCard
                    key={i}
                    letter={LETTERS[i]}
                    text={opt.text}
                    selected={selected === i}
                    status={status}
                    disabled={debriefPhase !== "idle" || selected !== null}
                    onClick={() => { if (debriefPhase === "idle") setSelected(i); }}
                  />
                );
              })}
            </div>

            {selected !== null && debriefPhase === "idle" && (
              <>
                {error && (
                  <p className="mt-3 text-sm text-destructive">{error}</p>
                )}
                <Button
                  className="mt-3 w-full"
                  size="lg"
                  disabled={sending}
                  onClick={startDebrief}
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Starting debrief…
                    </span>
                  ) : "Start Debrief →"}
                </Button>
              </>
            )}
          </div>

          {/* Verdict card — shown after debrief completes */}
          {verdict && debriefPhase === "complete" && (
            <div className={cn(
              "rounded-xl border p-4",
              verdict.isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("font-bold text-sm", verdict.isCorrect ? "text-success" : "text-destructive")}>
                  {verdict.isCorrect ? "✓ Correct" : "✗ Incorrect"}
                </span>
                {verdict.trapType && (
                  <span className="text-xs text-muted-foreground">
                    Trap: {verdict.trapType.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {verdict.sourceLines && (
                <p className="text-xs text-muted-foreground italic">
                  ↑ Answer region highlighted in the article
                </p>
              )}
              <Button className="mt-3 w-full" size="lg" onClick={nextQuestion}>
                {isLastQuestion ? "View Session Summary →" : "Next Question →"}
              </Button>
            </div>
          )}

          {/* Socratic chat */}
          {debriefPhase !== "idle" && (
            <div className="rounded-xl border border-border bg-card flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Socratic Debrief
                </span>
                {canGiveUp && (
                  <button
                    type="button"
                    onClick={() => sendMessage(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    I give up — show me the answer
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-80">
                {conversation.map((msg, i) => (
                  <div
                    key={i}
                    className={cn("flex", msg.role === "student" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        msg.role === "tutor"
                          ? "bg-muted text-foreground rounded-tl-sm"
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {sending && conversation.length > 0 && conversation[conversation.length - 1].role === "student" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              {debriefPhase === "active" && (
                <div className="border-t border-border p-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 relative">
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        disabled={sending}
                        rows={2}
                        maxLength={MAX_MSG_LENGTH}
                        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                        placeholder="Explain your reasoning… (Enter to send, Shift+Enter for newline)"
                      />
                      {/* Live voice preview overlay */}
                      {voiceRecording && voiceInterim && (
                        <div className="absolute bottom-1 left-1 right-1 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground italic pointer-events-none border border-primary/20">
                          {voiceInterim}…
                        </div>
                      )}
                      <div className={cn(
                        "mt-0.5 text-right text-xs",
                        inputText.length > MAX_MSG_LENGTH * 0.9 ? "text-amber-500" : "text-muted-foreground"
                      )}>
                        {inputText.length} / {MAX_MSG_LENGTH}
                      </div>
                    </div>
                    {voiceSupported && (
                      <VoiceMicButton
                        isRecording={voiceRecording}
                        onClick={voiceToggle}
                        className="mb-5"
                      />
                    )}
                    <Button
                      size="sm"
                      disabled={!inputText.trim() || inputText.trim().length > MAX_MSG_LENGTH || sending}
                      onClick={() => {
                        if (voiceRecording) voiceStop();
                        sendMessage();
                      }}
                      className="mb-5"
                    >
                      Send
                    </Button>
                  </div>
                  {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
