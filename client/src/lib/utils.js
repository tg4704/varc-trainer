import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Standard shadcn className utility — merges tailwind classes, dedupes conflicts.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
