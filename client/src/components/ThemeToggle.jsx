import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "../theme.jsx";
import { Button } from "./ui/button.jsx";

// Three-state cycle: light -> dark -> system -> light.
// Icon reflects the *chosen* mode, not the resolved color. Tooltip via title.
export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light" ? "Light mode" : theme === "dark" ? "Dark mode" : "System theme";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={`${label}: click to cycle`}
      aria-label="Toggle theme"
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
