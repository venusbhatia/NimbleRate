import { OccupancyBarChart } from "../components/charts/OccupancyBarChart";
import { PriceHeatmap } from "../components/charts/PriceHeatmap";
import { PriceLineChart } from "../components/charts/PriceLineChart";
import { Skeleton } from "../components/ui/Skeleton";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { EventsList } from "../features/events/EventsList";
import { KPICards } from "../features/pricing/KPICards";
import { MultiplierBreakdown } from "../features/pricing/MultiplierBreakdown";
import { WeatherWidget } from "../features/weather/WeatherWidget";

export function DashboardPage() {
  const { model, eventDates, isLoading, isFetching } = useDashboardData();

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

  return (
    <div className="space-y-6">
      <KPICards kpis={model.kpis} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <PriceHeatmap pricing={model.pricing} eventDates={eventDates} />
        </div>
        {anchorRecommendation ? <MultiplierBreakdown recommendation={anchorRecommendation} /> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <PriceLineChart data={model.pricing} />
          <OccupancyBarChart data={model.pricing} />
        </div>
        <EventsList events={model.events} />
      </div>

      <WeatherWidget weather={model.weather} />

      {isFetching ? (
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Refreshing pricing inputs...</p>
      ) : null}
    </div>
  );
}
