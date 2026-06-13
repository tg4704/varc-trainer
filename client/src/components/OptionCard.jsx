import { cn } from "../lib/utils.js";
import Icon from "./Icon.jsx";

// status: null (pre-submit) | "correct" | "wrong" | "correct-unselected" | "trap"
// Renders the Graspr signature option card: outlined letter chip + left accent
// border, green pulse on the correct answer.
export default function OptionCard({
  letter,
  text,
  selected,
  status = null,
  disabled = false,
  eliminated = false,
  trapBadge = false,
  onClick,
}) {
  const cls = ["opt"];
  let letterColor;
  if (status === "correct") {
    cls.push("opt-correct", "opt-pulse");
    letterColor = "var(--green)";
  } else if (status === "correct-unselected") {
    cls.push("opt-correct");
    letterColor = "var(--green)";
  } else if (status === "wrong") {
    cls.push("opt-wrong");
    letterColor = "var(--red)";
  } else if (status === "trap") {
    cls.push("opt-trap");
    letterColor = "var(--trap)";
  } else if (selected) {
    cls.push("opt-sel");
    letterColor = "var(--teal)";
  }
  if (eliminated) cls.push("opt-elim");
  if (disabled) cls.push("opt-locked");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(cls.join(" "))}
      style={{ cursor: disabled ? "default" : "pointer" }}
    >
      <span className="opt-letter" style={letterColor ? { color: letterColor } : undefined}>
        {letter}
      </span>
      <span className="opt-text">{text}</span>
      {trapBadge && (
        <span
          className="badge"
          style={{ flex: "none", marginLeft: "auto", color: "#0F1117", background: "var(--trap)", fontSize: 10, letterSpacing: "0.08em" }}
        >
          TRAP
        </span>
      )}
      {status === "correct" && !trapBadge && (
        <span style={{ flex: "none", marginLeft: "auto", color: "var(--green)" }}>
          <Icon name="check" size={16} stroke={2.2} />
        </span>
      )}
    </button>
  );
}
