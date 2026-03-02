import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 bg-white p-6 shadow-card transition-shadow duration-200 hover:shadow-card-hover",
        "dark:border-gray-700 dark:bg-neutral-900",
        className
      )}
      {...props}
    />
  );
}
