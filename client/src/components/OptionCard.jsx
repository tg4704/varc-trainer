import { cn } from "../lib/utils.js";

// status: null (pre-submit) | "correct" | "wrong" | "correct-unselected"
export default function OptionCard({
  letter,
  text,
  selected,
  status = null,
  disabled = false,
  onClick,
}) {
  let stateClasses;
  if (status === "correct") {
    stateClasses = "border-success bg-success/10";
  } else if (status === "wrong") {
    stateClasses = "border-destructive bg-destructive/10";
  } else if (status === "correct-unselected") {
    stateClasses = "border-success bg-card";
  } else if (selected) {
    stateClasses = "border-primary bg-primary/5";
  } else {
    stateClasses = "border-border bg-card hover:border-foreground/40";
  }

  let letterClasses;
  if (status === "correct" || status === "correct-unselected") {
    letterClasses = "bg-success text-success-foreground";
  } else if (status === "wrong") {
    letterClasses = "bg-destructive text-destructive-foreground";
  } else if (selected) {
    letterClasses = "bg-primary text-primary-foreground";
  } else {
    letterClasses = "bg-muted text-muted-foreground";
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
        stateClasses,
        disabled ? "cursor-default" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold transition-colors",
          letterClasses
        )}
      >
        {letter}
      </span>
      <span className="text-sm leading-relaxed text-foreground pt-0.5">
        {text}
      </span>
    </button>
  );
}
