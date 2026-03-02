import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useDashboardStore } from "../../store/useDashboardStore";
import { dashboardNavItems } from "./navigation";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";

export function Header() {
  const theme = useDashboardStore((state) => state.theme);
  const activeNav = useDashboardStore((state) => state.activeNav);
  const setActiveNav = useDashboardStore((state) => state.setActiveNav);
  const pricePeriod = useDashboardStore((state) => state.pricePeriod);
  const setPricePeriod = useDashboardStore((state) => state.setPricePeriod);
  const toggleTheme = useDashboardStore((state) => state.toggleTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <header className="rounded-2xl border border-gray-200/70 bg-white/90 p-4 shadow-card backdrop-blur md:p-5 dark:border-gray-700 dark:bg-neutral-900/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue Intelligence</p>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Dynamic Pricing Command Center</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-neutral-900">
            {[7, 14, 30].map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setPricePeriod(period as 7 | 14 | 30)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                  pricePeriod === period
                    ? "bg-gold-100 text-gold-900"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                )}
              >
                {period}D
              </button>
            ))}
          </div>
          <Button onClick={toggleTheme} variant="secondary" className="gap-2">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark" : "Light"}
          </Button>
        </div>
      </div>

      <nav className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:justify-start",
                activeNav === item.id
                  ? "bg-gold-100 text-gold-900"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
