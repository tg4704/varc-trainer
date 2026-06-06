import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-muted text-muted-foreground",
        outline: "border border-input text-foreground",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        destructive: "bg-destructive/15 text-destructive",
        // semantic per-type accent colors for question types (light + dark friendly)
        inference: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
        tone: "bg-purple-500/15 text-purple-600 dark:text-purple-300",
        title: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
        detail: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
        application: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
