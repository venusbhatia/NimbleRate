import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-gold-500 text-dune-950 hover:bg-gold-400 shadow-sm",
  secondary:
    "bg-white text-dune-900 border border-gray-200 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-neutral-700",
  ghost:
    "text-dune-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5"
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
