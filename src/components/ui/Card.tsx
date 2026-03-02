import type { HTMLAttributes } from "react";
import { cn } from "./cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass";
}

const variants = {
  default:
    "rounded-2xl border border-gray-200 bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover dark:border-gray-700 dark:bg-neutral-900",
  glass:
    "rounded-2xl border border-white/20 bg-white/60 p-6 shadow-card backdrop-blur-xl transition-shadow duration-200 hover:shadow-card-hover dark:border-gray-700/40 dark:bg-neutral-900/60"
};

export function Card({ className, variant = "default", ...props }: CardProps) {
  return <div className={cn(variants[variant], className)} {...props} />;
}
