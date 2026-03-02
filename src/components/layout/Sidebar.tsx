import { CalendarRange, ChartNoAxesCombined, Cog, Home, Ticket, X } from "lucide-react";
import { useDashboardStore } from "../../store/useDashboardStore";
import { Link } from "../../router";
import { cn } from "../ui/cn";
import logoSvg from "../../assets/nimblerate_logo.svg";

const navItems = [
  { id: "dashboard", label: "Overview", description: "KPIs & rate calendar", icon: ChartNoAxesCombined },
  { id: "calendar", label: "Rate Trends", description: "Charts & forecasts", icon: CalendarRange },
  { id: "events", label: "Events", description: "What's happening nearby", icon: Ticket },
  { id: "settings", label: "Settings", description: "Property & search config", icon: Cog }
] as const;

export function Sidebar() {
  const activeNav = useDashboardStore((state) => state.activeNav);
  const setActiveNav = useDashboardStore((state) => state.setActiveNav);
  const isMobileMenuOpen = useDashboardStore((state) => state.isMobileMenuOpen);
  const closeMobileMenu = useDashboardStore((state) => state.closeMobileMenu);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <Link to="dashboard" className="flex items-center gap-2">
          <img src={logoSvg} alt="NimbleRate" className="h-9 logo-dark-mode" />
        </Link>
        <button
          type="button"
          onClick={closeMobileMenu}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 md:hidden dark:hover:bg-neutral-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                activeNav === item.id
                  ? "bg-gold-100 text-gold-900 dark:bg-gold-900/30 dark:text-gold-300"
                  : "text-dune-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">{item.description}</p>
              </div>
            </button>
          );
        })}
      </nav>

      <Link
        to=""
        className="mt-6 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-dune-500 transition hover:bg-gray-100 hover:text-dune-800 dark:text-gray-400 dark:hover:bg-neutral-800 dark:hover:text-gray-200"
      >
        <Home className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="sticky top-6 hidden rounded-2xl border border-gray-200/70 bg-white/90 p-5 shadow-card backdrop-blur md:block dark:border-gray-700 dark:bg-neutral-900/90">
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={closeMobileMenu}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 border-r border-gray-200 bg-white p-5 shadow-xl md:hidden dark:border-gray-700 dark:bg-neutral-900">
            {sidebarContent}
          </div>
        </>
      ) : null}
    </>
  );
}
