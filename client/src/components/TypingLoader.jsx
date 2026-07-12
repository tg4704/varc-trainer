import { useEffect, useState } from "react";

// Calm, minimal "AI is working" indicator — plain background, clean font,
// text reveals like it's being typed (~1s for a short phrase), then just
// sits with a blinking cursor for however long the actual wait is. No
// spinner, no gimmicks — matches the same reveal technique already used by
// the Home page's interactive demo card.
export default function TypingLoader({ text, className = "" }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    setTyped("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 26);
    return () => clearInterval(iv);
  }, [text]);

  return (
    <p className={`text-center text-xs dim ${className}`}>
      {typed}
      <span className="ml-px inline-block animate-pulse">▍</span>
    </p>
  );
}
