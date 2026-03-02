import type { HTMLAttributes } from "react";
import { cn } from "./cn";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "positive" | "negative" | "neutral" | "gold";
}

const tones = {
  positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  negative: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  neutral: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  gold: "bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300"
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
