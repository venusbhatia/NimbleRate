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
import { WeatherWidget } from "../features/weather/WeatherWidget";
import { useDashboardStore } from "../store/useDashboardStore";

export function DashboardPage() {
  const { model, eventDates, isLoading, isFetching } = useDashboardData();
  const activeNav = useDashboardStore((state) => state.activeNav);
  const pricePeriod = useDashboardStore((state) => state.pricePeriod);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
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
      <Card className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-gold-50 via-white to-emerald-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current View</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">{viewTitle}</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Showing {pricePeriod}-day horizon for pricing recommendations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={hasEvents ? "positive" : "negative"}>{hasEvents ? "Events Live" : "No Events"}</Badge>
          <Badge tone={hasWeather ? "positive" : "negative"}>{hasWeather ? "Weather Live" : "No Weather"}</Badge>
          <Badge tone={isFetching ? "gold" : "neutral"}>{isFetching ? "Refreshing" : "Stable"}</Badge>
        </div>
      </Card>

      <KPICards kpis={model.kpis} />

      {(activeNav === "dashboard" || activeNav === "calendar") && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <PriceHeatmap pricing={activeNav === "calendar" ? scopedPricing : model.pricing} eventDates={eventDates} />
          </div>
          {anchorRecommendation ? <MultiplierBreakdown recommendation={anchorRecommendation} /> : null}
        </div>
      )}

      {(activeNav === "dashboard" || activeNav === "calendar") && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <PriceLineChart data={scopedPricing} />
            <OccupancyBarChart data={scopedPricing} />
          </div>
          <EventsList events={scopedEvents} />
        </div>
      )}

      {(activeNav === "dashboard" || activeNav === "events") && <WeatherWidget weather={model.weather} />}

      {activeNav === "events" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <EventsList events={model.events} limit={12} />
          </div>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Demand Summary</p>
            <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{model.events.length}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Total events in selected market window.</p>
          </Card>
        </div>
      )}

      {activeNav === "settings" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Data Sources</p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-800">Amadeus pricing and hotel inventory</p>
              <p className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-800">Ticketmaster demand signals</p>
              <p className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-800">Nager holiday and long weekend calendar</p>
              <p className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-neutral-800">OpenWeather forecast overlays</p>
            </div>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Team Workflow</p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="rounded-lg bg-gold-50 px-3 py-2 text-gold-900">Use `feature/*` branches for isolated work.</p>
              <p className="rounded-lg bg-gold-50 px-3 py-2 text-gold-900">Merge into `dev` for integration validation.</p>
              <p className="rounded-lg bg-gold-50 px-3 py-2 text-gold-900">Promote `dev` to `main` when stable.</p>
            </div>
          </Card>
        </div>
      )}

      {isFetching ? (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Refreshing pricing inputs...</p>
      ) : null}
    </div>
  );
}
