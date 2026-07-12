import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn className utility — merges tailwind classes, dedupes conflicts.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// scrollIntoView that respects the user's reduced-motion preference — the
// global CSS reduced-motion block only affects CSS animation/transition, not
// JS-driven `behavior: "smooth"`, so gate it here.
export function scrollIntoViewMotionSafe(el, options = {}) {
  if (!el) return;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", ...options });
}
