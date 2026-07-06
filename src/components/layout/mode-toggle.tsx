"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { useLanguage } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

/**
 * Light/dark mode toggle — a single icon button that flips the app
 * between the two modes. Sun shows in light mode (click → go dark),
 * moon shows in dark mode (click → go light); the label always names
 * the destination so screen-reader users hear what the click does.
 *
 * 40×40 hit target to match the header's other touch controls.
 */
export function ModeToggle({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme();
  const { t } = useLanguage();
  const goingTo = mode === "dark" ? "light" : "dark";
  const ariaKey = goingTo === "light" ? "aria.switchToLight" : "aria.switchToDark";
  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={t(ariaKey)}
      title={t(ariaKey)}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {mode === "dark" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}
