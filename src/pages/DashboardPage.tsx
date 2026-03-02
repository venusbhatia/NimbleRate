import { OccupancyBarChart } from "../components/charts/OccupancyBarChart";
import { PriceHeatmap } from "../components/charts/PriceHeatmap";
import { PriceLineChart } from "../components/charts/PriceLineChart";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { EventsList } from "../features/events/EventsList";
import { KPICards } from "../features/pricing/KPICards";
import { MultiplierBreakdown } from "../features/pricing/MultiplierBreakdown";
import { SearchPanel } from "../features/search/SearchPanel";
import { WeatherWidget } from "../features/weather/WeatherWidget";
import { useDashboardStore } from "../store/useDashboardStore";

export function DashboardPage() {
  const { model, eventDates, isLoading, isFetching } = useDashboardData();
  const activeNav = useDashboardStore((state) => state.activeNav);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const anchorRecommendation = model.pricing[0];
  const scopedPricing = model.pricing.slice(0, pricePeriod);
  const scopedEvents = model.events.slice(0, Math.max(6, pricePeriod));
  const hasEvents = model.events.length > 0;
  const hasWeather = model.weather.length > 0;
  const viewTitle =
    activeNav === "dashboard"
      ? "Market Overview"
      : activeNav === "calendar"
        ? "Calendar Intelligence"
        : activeNav === "events"
          ? "Event Demand Radar"
          : "Workspace Settings";

  return (
    <div className="space-y-6">
      {/* Refreshing banner */}
      {isFetching ? (
        <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm font-medium text-gold-900 dark:border-gold-700/40 dark:bg-gold-900/20 dark:text-gold-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-500" />
          Refreshing pricing data…
        </div>
      ) : null}

      {/* ===== OVERVIEW SECTION ===== */}
      {activeNav === "dashboard" ? (
        <>
          <SearchPanel />
          <KPICards kpis={model.kpis} />

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <PriceHeatmap pricing={model.pricing} eventDates={eventDates} />
            </div>
            {anchorRecommendation ? <MultiplierBreakdown recommendation={anchorRecommendation} /> : null}
          </div>

          <WeatherWidget weather={model.weather} />
        </>
      ) : null}

      {/* ===== RATE TRENDS SECTION ===== */}
      {activeNav === "calendar" ? (
        <>
          <PriceHeatmap pricing={model.pricing} eventDates={eventDates} />
          <div className="grid gap-6 xl:grid-cols-2">
            <PriceLineChart data={model.pricing} />
            <OccupancyBarChart data={model.pricing} />
          </div>
        </>
      ) : null}

      {/* ===== EVENTS SECTION ===== */}
      {activeNav === "events" ? (
        <EventsList events={model.events} />
      ) : null}

      {/* ===== SETTINGS SECTION ===== */}
      {activeNav === "settings" ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-card dark:border-gray-700 dark:bg-neutral-900/90">
            <h2 className="mb-1 text-lg font-bold tracking-tight">Property Settings</h2>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Configure your location, property type, and occupancy to get accurate pricing recommendations.
            </p>
            <SearchPanel />
          </div>
        </div>
      ) : null}
    </div>
  );
}
