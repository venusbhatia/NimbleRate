import { Menu, Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useDashboardStore } from "../../store/useDashboardStore";
import { dashboardNavItems } from "./navigation";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";

const sectionLabels: Record<string, string> = {
  dashboard: "Overview",
  calendar: "Rate Trends",
  events: "Events",
  settings: "Settings"
};

export function Header() {
  const theme = useDashboardStore((state) => state.theme);
  const activeNav = useDashboardStore((state) => state.activeNav);
  const setActiveNav = useDashboardStore((state) => state.setActiveNav);
  const pricePeriod = useDashboardStore((state) => state.pricePeriod);
  const setPricePeriod = useDashboardStore((state) => state.setPricePeriod);
  const toggleTheme = useDashboardStore((state) => state.toggleTheme);
  const toggleMobileMenu = useDashboardStore((state) => state.toggleMobileMenu);
  const activeNav = useDashboardStore((state) => state.activeNav);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <header className="flex items-center justify-between rounded-2xl border border-gray-200/70 bg-white/90 p-4 shadow-card backdrop-blur md:p-5 dark:border-gray-700 dark:bg-neutral-900/90">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleMobileMenu}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-neutral-800"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {sectionLabels[activeNav] ?? "Dashboard"}
          </p>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            Today's Pricing Overview
          </h1>
        </div>
      </div>
      <Button onClick={toggleTheme} variant="secondary" size="sm">
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        {theme === "light" ? "Dark" : "Light"}
      </Button>
    </header>
  );
}
