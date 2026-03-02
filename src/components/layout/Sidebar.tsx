import { Sparkles } from "lucide-react";
import { useDashboardStore } from "../../store/useDashboardStore";
import { dashboardNavItems } from "./navigation";
import { cn } from "../ui/cn";

export function Sidebar() {
  const activeNav = useDashboardStore((state) => state.activeNav);
  const setActiveNav = useDashboardStore((state) => state.setActiveNav);

  return (
    <div className="sticky top-6 rounded-2xl border border-gray-200/70 bg-white/90 p-5 shadow-card backdrop-blur dark:border-gray-700 dark:bg-neutral-900/90">
      <div className="mb-8 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-gold-600" />
        <span className="text-lg font-bold tracking-tight">NimbleRate</span>
      </div>
      <nav className="space-y-2">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                activeNav === item.id
                  ? "bg-gold-100 text-gold-900"
                  : "text-dune-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
