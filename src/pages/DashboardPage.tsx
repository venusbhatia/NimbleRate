import { OccupancyBarChart } from "../components/charts/OccupancyBarChart";
import { PriceHeatmap } from "../components/charts/PriceHeatmap";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
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
import { confidenceTone, formatCompsetDelta, percentileBandLabel } from "../utils/priceEngineV2";

export function DashboardPage() {
  const {
    model,
    eventDates,
    holidayDates,
    longWeekendDates,
    highDemandDates,
    pricingReasonsByDate,
    sourceHealth,
    usageSummary,
    warnings,
    hasRunAnalysis,
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
  const providerUsageRows = usageSummary?.providers ?? model.providerUsage;

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

      {!hasRunAnalysis ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-200">
          <p className="font-semibold">Run analysis to load live market intelligence.</p>
          <p className="mt-1 text-blue-700 dark:text-blue-300">
            NimbleRate v2 only calls external providers when you explicitly click <strong>Run Analysis</strong>.
          </p>
        </div>
      ) : null}

      {warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="font-semibold">Partial data mode</p>
          <ul className="mt-2 space-y-1 text-xs">
            {warnings.slice(0, 4).map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
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

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="bg-white/95 dark:bg-neutral-900/95">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Market Anchor</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">${model.marketAnchor.anchorRate.toFixed(0)}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Compset median ${model.marketAnchor.compsetMedian.toFixed(0)} ({model.marketAnchor.source})
              </p>
              <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {formatCompsetDelta(model.compsetPosition.deltaVsMedian)}
              </p>
            </Card>

            <Card className="bg-white/95 dark:bg-neutral-900/95">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Compset Position</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">${model.compsetPosition.recommendedRate.toFixed(0)}</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone="neutral">{percentileBandLabel(model.compsetPosition.percentileBand)}</Badge>
                <Badge tone="gold">Target {(model.marketAnchor.targetMarketPosition * 100).toFixed(0)}%</Badge>
              </div>
            </Card>

            <Card className="bg-white/95 dark:bg-neutral-900/95">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Recommendation Confidence</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{model.recommendationConfidence.score}/100</p>
              <div className="mt-2">
                <Badge tone={confidenceTone(model.recommendationConfidence.level)} className="capitalize">
                  {model.recommendationConfidence.level}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{model.recommendationConfidence.reason}</p>
            </Card>
          </div>

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

          <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-card dark:border-gray-700 dark:bg-neutral-900/90">
            <h3 className="text-lg font-bold tracking-tight">Provider Usage & Budgets</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track external API calls and rotate credentials/accounts when nearing quota limits.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Used</th>
                    <th className="px-3 py-2">Remaining</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Guidance</th>
                  </tr>
                </thead>
                <tbody>
                  {providerUsageRows.length ? (
                    providerUsageRows.map((row) => (
                      <tr key={row.provider} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 font-medium uppercase">{row.provider}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {row.calls}/{row.quota} ({row.percentUsed.toFixed(1)}%)
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.remaining}</td>
                        <td className="px-3 py-2">
                          <Badge
                            tone={
                              row.status === "ok"
                                ? "positive"
                                : row.status === "warning"
                                  ? "gold"
                                  : "negative"
                            }
                            className="uppercase"
                          >
                            {row.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.recommendation}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400" colSpan={5}>
                        Usage counters will appear after the first analysis call.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
