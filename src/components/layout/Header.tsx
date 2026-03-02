import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useDashboardStore } from "../../store/useDashboardStore";
import { Button } from "../ui/Button";

export function Header() {
  const theme = useDashboardStore((state) => state.theme);
  const toggleTheme = useDashboardStore((state) => state.toggleTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return (
    <header className="flex items-center justify-between rounded-2xl border border-gray-200/70 bg-white/90 p-4 shadow-card backdrop-blur md:p-5 dark:border-gray-700 dark:bg-neutral-900/90">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue Intelligence</p>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">Dynamic Pricing Command Center</h1>
      </div>
      <Button onClick={toggleTheme} variant="secondary" className="gap-2">
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        {theme === "light" ? "Dark" : "Light"}
      </Button>
    </header>
  );
}
