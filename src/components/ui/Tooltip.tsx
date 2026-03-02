import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface TooltipProps {
  content: string;
  children?: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <span className="group relative inline-flex items-center">
      {children ?? <Info className="h-3.5 w-3.5 text-dune-400 transition-colors group-hover:text-gold-600" />}
      <span
        role="tooltip"
        className="pointer-events-none fixed z-50 mb-2 hidden whitespace-nowrap rounded-lg bg-dune-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:block group-hover:opacity-100 dark:bg-dune-100 dark:text-dune-950"
        style={{ bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }}
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-dune-900 dark:border-t-dune-100" />
      </span>
    </span>
  );
}
