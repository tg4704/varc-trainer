import { useEffect, useState } from "react";

// Shown in the Discuss thread while the coach's reply is in flight. A teal
// highlight glides across the words (.think-text in index.css) and the phrase
// swaps every couple of seconds so a slow reply doesn't look like a hang.
//
// Deliberately not TypingLoader: that one types a fixed string once and then
// sits there, which reads as "finished" during a long wait. This keeps moving.
const PHRASES = [
  "Re-reading the passage",
  "Checking that against your answer",
  "Finding the lines that matter",
  "Putting it into words",
];

export default function CoachThinking() {
  const [i, setI] = useState(0);

  useEffect(() => {
    // Stop advancing at the last phrase rather than looping back to the first,
    // which would suggest the request restarted.
    const iv = setInterval(() => setI((n) => Math.min(n + 1, PHRASES.length - 1)), 2400);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex justify-start">
      <div
        className="flex max-w-[85%] items-center gap-2 rounded-2xl px-3.5 py-2"
        style={{ background: "rgba(255,255,255,0.05)", borderTopLeftRadius: 4 }}
        role="status"
        aria-live="polite"
      >
        <span className="think-text text-sm leading-relaxed">{PHRASES[i]}</span>
        <span className="flex flex-none items-center gap-[3px]" aria-hidden="true">
          <i className="think-dot" />
          <i className="think-dot" />
          <i className="think-dot" />
        </span>
      </div>
    </div>
  );
}
