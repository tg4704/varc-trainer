import { cn } from "../lib/utils.js";

/**
 * Character counter for a capped input.
 *
 * Pairs with a `maxLength` on the field itself. `maxLength` stops typing
 * silently - the caret just stops moving - so without a counter the user's
 * only signal that a cap exists is their keyboard appearing to break. This
 * shows the cap before they reach it and turns amber as they approach.
 *
 * Stays hidden until 75% of the cap so short answers (the common case) aren't
 * cluttered with a counter nobody needs. Pass `alwaysShow` where the limit is
 * itself part of the instruction.
 */
export default function CharCount({ value = "", max, alwaysShow = false, className }) {
  const len = value.length;
  const nearLimit = len > max * 0.75;
  const atLimit = len >= max;

  return (
    <div
      className={cn("mono mt-1 text-right text-[11px]", className)}
      style={{
        color: atLimit ? "var(--red, #F87171)" : nearLimit ? "var(--amber, #F5B544)" : "var(--text-2)",
        visibility: alwaysShow || nearLimit ? "visible" : "hidden",
      }}
      aria-live="polite"
    >
      {len}/{max}
    </div>
  );
}
