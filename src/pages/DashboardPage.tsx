import { OccupancyBarChart } from "../components/charts/OccupancyBarChart";
import { PriceHeatmap } from "../components/charts/PriceHeatmap";
import { Badge } from "../components/ui/Badge";
import { PriceLineChart } from "../components/charts/PriceLineChart";
import { Skeleton } from "../components/ui/Skeleton";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { EventsList } from "../features/events/EventsList";
import { ActionRecommendations } from "../features/insights/ActionRecommendations";
import { KPICards } from "../features/pricing/KPICards";
import { MultiplierBreakdown } from "../features/pricing/MultiplierBreakdown";
import { SearchPanel } from "../features/search/SearchPanel";
import { WeatherWidget } from "../features/weather/WeatherWidget";
import { useDashboardStore } from "../store/useDashboardStore";

export function DashboardPage() {
  const {
    model,
    eventDates,
    holidayDates,
    longWeekendDates,
    highDemandDates,
    pricingReasonsByDate,
    sourceHealth,
    isLoading,
    isFetching,
    apiError
  } = useDashboardData();
  const activeNav = useDashboardStore((state) => state.activeNav);
  const pricePeriod = useDashboardStore((state) => state.pricePeriod);

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

  return (
    <div className="space-y-6">
      {apiError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-200">
          <p className="font-semibold">{apiError.summary}</p>
          <p className="mt-1 text-red-700 dark:text-red-300">Some sections may be incomplete.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sourceHealth.map((source) => (
              <Badge
                key={source.source}
                tone={source.status === "ok" ? "positive" : source.status === "loading" ? "gold" : "negative"}
              >
                {source.source}: {source.status}
              </Badge>
            ))}
          </div>
          <details className="mt-3 rounded-lg border border-red-200/70 bg-white/70 p-3 text-xs dark:border-red-700/40 dark:bg-neutral-900/40">
            <summary className="cursor-pointer font-semibold">View exact API error details</summary>
            <div className="mt-3 space-y-3">
              {apiError.details.map((detail, index) => (
                <div key={`${detail.source}-${index}`} className="rounded-md border border-red-200/70 bg-red-50/60 p-2 dark:border-red-800/40 dark:bg-red-900/20">
                  <p className="font-semibold">
                    {detail.source.toUpperCase()}
                    {detail.status ? ` (${detail.status})` : ""}
                  </p>
                  <p className="mt-1">{detail.message}</p>
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-all dark:bg-neutral-950">
                    {detail.raw}
                  </pre>
                </div>
              ))}
            </div>
          </details>
        </div>
      ) : null}

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
              <PriceHeatmap
                pricing={model.pricing}
                eventDates={eventDates}
                holidayDates={holidayDates}
                longWeekendDates={longWeekendDates}
                highDemandDates={highDemandDates}
                pricingReasonsByDate={pricingReasonsByDate}
              />
            </div>
            {anchorRecommendation ? <MultiplierBreakdown recommendation={anchorRecommendation} /> : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ActionRecommendations
                demand={model.insights.demand}
                dataQuality={model.insights.dataQuality}
                actions={model.insights.actions}
                signals={model.insights.signals}
              />
            </div>
            <EventsList events={model.events} limit={5} />
          </div>

          <WeatherWidget weather={model.weather} />
        </>
      ) : null}

      {/* ===== RATE TRENDS SECTION ===== */}
      {activeNav === "calendar" ? (
        <>
          <PriceHeatmap
            pricing={model.pricing}
            eventDates={eventDates}
            holidayDates={holidayDates}
            longWeekendDates={longWeekendDates}
            highDemandDates={highDemandDates}
            pricingReasonsByDate={pricingReasonsByDate}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <PriceLineChart data={scopedPricing} />
            <OccupancyBarChart data={scopedPricing} />
          </div>
        </>
      ) : null}

      {/* ===== EVENTS SECTION ===== */}
      {activeNav === "events" ? (
        <EventsList events={model.events} limit={Math.max(6, pricePeriod)} />
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

          <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-card dark:border-gray-700 dark:bg-neutral-900/90">
            <h3 className="text-lg font-bold tracking-tight">Source Health</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Live status of Hotels, Events, Holidays, and Weather pipelines.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Last Updated</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceHealth.map((row) => (
                    <tr key={row.source} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2 font-medium">{row.source}</td>
                      <td className="px-3 py-2">
                        <Badge tone={row.status === "ok" ? "positive" : row.status === "loading" ? "gold" : "negative"}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                        {row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : "Not yet"}
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.errorSummary ?? "Healthy"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
