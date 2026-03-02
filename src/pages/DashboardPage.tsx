import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CompsetPositionChart } from "../components/charts/CompsetPositionChart";
import { HistoricalTrendChart } from "../components/charts/HistoricalTrendChart";
import { OccupancyBarChart } from "../components/charts/OccupancyBarChart";
import { PriceHeatmap } from "../components/charts/PriceHeatmap";
import { PriceLineChart } from "../components/charts/PriceLineChart";
import { createRatePushJob, getRatePushJob, listRatePushJobs } from "../services/channelManagerApi";
import { getCompsetSuggestions } from "../services/compsetApi";
import { createProperty, getProperties, updateProperty } from "../services/propertiesApi";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { useDashboardData } from "../features/dashboard/useDashboardData";
import { EventsList } from "../features/events/EventsList";
import { ActionRecommendations } from "../features/insights/ActionRecommendations";
import { ParitySummaryCard } from "../features/insights/ParitySummaryCard";
import { KPICards } from "../features/pricing/KPICards";
import { MultiplierBreakdown } from "../features/pricing/MultiplierBreakdown";
import { SearchPanel } from "../features/search/SearchPanel";
import { WeatherWidget } from "../features/weather/WeatherWidget";
import { useDashboardStore } from "../store/useDashboardStore";
import { useSearchStore } from "../store/useSearchStore";
import { confidenceTone, formatCompsetDelta, percentileBandLabel } from "../utils/priceEngineV2";
import type { DateExplainability } from "../types/dashboard";
import { computeQuotaState, fallbackLabel, quotaTone } from "../utils/dashboardStatus";

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatDateSafe(value: string | null | undefined, pattern: string): string {
  if (!value) {
    return "Date unavailable";
  }
  const parsed = parseISO(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "Date unavailable";
  }
  return format(parsed, pattern);
}

function factorLabel(key: keyof DateExplainability["factors"]) {
  switch (key) {
    case "occupancyRate":
      return "Occupancy / Pace";
    case "dayOfWeek":
      return "Day of Week";
    case "seasonality":
      return "Seasonality";
    case "events":
      return "Events";
    case "weather":
      return "Weather";
    case "holiday":
      return "Holidays";
    case "leadTime":
      return "Lead Time";
    case "searchDemand":
      return "Search Demand";
    case "travelIntent":
      return "Travel Intent";
    case "campusDemand":
      return "Campus Demand";
    default:
      return key;
  }
}

export function DashboardPage() {
  const {
    model,
    eventDates,
    holidayDates,
    longWeekendDates,
    highDemandDates,
    pricingReasonsByDate,
    explainabilityByDate,
    sourceHealth,
    usageSummary,
    warnings,
    analysisContext,
    paceSource,
    pmsSyncAt,
    supplySource,
    compsetSuggestionVersion,
    fallbacksUsed,
    history,
    parity,
    pmsHealth,
    supply,
    portfolio,
    anomalies,
    revenueAnalytics,
    hasRunAnalysis,
    isLoading,
    isFetching,
    apiError
  } = useDashboardData();
  const activeNav = useDashboardStore((state) => state.activeNav);
  const pricePeriod = useDashboardStore((state) => state.pricePeriod);
  const directRate = useSearchStore((state) => state.directRate);
  const setUseSuggestedCompset = useSearchStore((state) => state.setUseSuggestedCompset);
  const searchState = useSearchStore((state) => ({
    propertyId: state.propertyId,
    cityName: state.cityName,
    countryCode: state.countryCode,
    latitude: state.latitude,
    longitude: state.longitude,
    checkInDate: state.checkInDate,
    checkOutDate: state.checkOutDate
  }));
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [pushNotes, setPushNotes] = useState("");
  const [newProperty, setNewProperty] = useState({
    propertyId: "",
    name: "",
    countryCode: "US",
    cityName: "Austin"
  });

  const safePricing = model.pricing
    .filter((entry) => Boolean(entry?.date))
    .map((entry) => ({
      ...entry,
      baseRate: safeNumber(entry.baseRate, 0),
      finalRate: safeNumber(entry.finalRate, 0),
      finalMultiplier: safeNumber(entry.finalMultiplier, 1),
      rawMultiplier: safeNumber(entry.rawMultiplier, 1)
    }));
  const anchorRecommendation = safePricing[0];
  const scopedPricing = safePricing.slice(0, pricePeriod);
  const providerUsageRows = usageSummary?.providers ?? model.providerUsage;
  const compsetRates = model.compset.hotels
    .flatMap((hotel) => hotel.otaRates.map((rate) => rate.rate))
    .filter((rate) => Number.isFinite(rate) && rate > 0);
  const chartRates = compsetRates.length ? compsetRates : [safeNumber(model.marketAnchor.compsetMedian, 0)];

  const activeSelectedDate =
    selectedDate && safePricing.some((entry) => entry.date === selectedDate)
      ? selectedDate
      : safePricing[0]?.date ?? null;

  const selectedExplainability = activeSelectedDate
    ? explainabilityByDate.get(activeSelectedDate) ?? null
    : null;

  const sortedFactorEntries = selectedExplainability
    ? (Object.entries(selectedExplainability.factors) as Array<
        [keyof DateExplainability["factors"], DateExplainability["factors"][keyof DateExplainability["factors"]]]
      >).sort((a, b) => Math.abs(b[1].contribution) - Math.abs(a[1].contribution))
    : [];

  const isMakcorpsDegraded = fallbacksUsed.some(
    (fallback) => fallback === "makcorps_fallback_amadeus" || fallback === "compset_fallback_static"
  );

  const propertiesQuery = useQuery({
    queryKey: ["properties"],
    staleTime: 30_000,
    queryFn: getProperties
  });

  const ratePushJobsQuery = useQuery({
    queryKey: ["rate-push-jobs", searchState.propertyId],
    enabled: hasRunAnalysis && activeNav === "settings",
    staleTime: 10_000,
    queryFn: async () => listRatePushJobs({ propertyId: searchState.propertyId, limit: 25 })
  });

  const selectedJobQuery = useQuery({
    queryKey: ["rate-push-job", selectedJobId],
    enabled: selectedJobId !== null,
    queryFn: async () => getRatePushJob(selectedJobId as number)
  });

  const compsetSuggestionsQuery = useQuery({
    queryKey: [
      "compset-suggestions",
      searchState.propertyId,
      searchState.cityName,
      searchState.countryCode,
      searchState.latitude,
      searchState.longitude
    ],
    enabled: hasRunAnalysis && activeNav === "settings",
    staleTime: 60_000,
    queryFn: async () =>
      getCompsetSuggestions({
        propertyId: searchState.propertyId,
        cityName: searchState.cityName,
        countryCode: searchState.countryCode,
        latitude: searchState.latitude,
        longitude: searchState.longitude,
        maxResults: 8
      })
  });

  const createPropertyMutation = useMutation({
    mutationFn: createProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setNewProperty({
        propertyId: "",
        name: "",
        countryCode: "US",
        cityName: "Austin"
      });
    }
  });

  const updatePropertyMutation = useMutation({
    mutationFn: ({
      propertyId,
      totalRooms
    }: {
      propertyId: string;
      totalRooms: number;
    }) => updateProperty(propertyId, { totalRooms }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    }
  });

  const createRatePushMutation = useMutation({
    mutationFn: createRatePushJob,
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["rate-push-jobs", searchState.propertyId] });
      setSelectedJobId(payload.jobId);
    }
  });

  const triggerRatePush = () => {
    const baseRates = safePricing.slice(0, 7).map((day) => ({
      date: day.date,
      rate: Number(day.finalRate.toFixed(2)),
      currency: "USD"
    }));

    if (!baseRates.length) {
      return;
    }

    createRatePushMutation.mutate({
      propertyId: searchState.propertyId,
      marketKey: `${searchState.cityName}-${searchState.countryCode}`.toLowerCase(),
      mode: "dry_run",
      manualApproval: false,
      notes: pushNotes || undefined,
      rates: baseRates
    });
  };

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
                <div
                  key={`${detail.source}-${index}`}
                  className="rounded-md border border-red-200/70 bg-red-50/60 p-2 dark:border-red-800/40 dark:bg-red-900/20"
                >
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
          {fallbacksUsed.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {fallbacksUsed.map((fallback) => (
                <Badge key={fallback} tone="gold">
                  {fallbackLabel(fallback)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {isFetching ? (
        <div className="flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm font-medium text-gold-900 dark:border-gold-700/40 dark:bg-gold-900/20 dark:text-gold-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold-500" />
          Refreshing pricing data…
        </div>
      ) : null}

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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={confidenceTone(model.recommendationConfidence.level)} className="capitalize">
                  {model.recommendationConfidence.level}
                </Badge>
                <Badge tone="neutral">{analysisContext.cityName}</Badge>
                {analysisContext.propertyId ? <Badge tone="neutral">Property {analysisContext.propertyId}</Badge> : null}
                <Badge tone="neutral" className="uppercase">{analysisContext.pmsMode}</Badge>
                {compsetSuggestionVersion ? <Badge tone="gold">Compset {compsetSuggestionVersion}</Badge> : null}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{model.recommendationConfidence.reason}</p>
            </Card>
          </div>

          <Card className="bg-white/95 dark:bg-neutral-900/95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold tracking-tight">Demand Intent</h3>
              <Badge tone="gold">Phase 2</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Search Momentum</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-dune-900 dark:text-gray-100">
                  {model.insights.signals.searchMomentumIndex}
                  <span className="text-sm font-medium text-gray-500">/100</span>
                </p>
              </div>
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Flight Demand</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-dune-900 dark:text-gray-100">
                  {model.insights.signals.flightDemandIndex}
                  <span className="text-sm font-medium text-gray-500">/100</span>
                </p>
              </div>
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Campus Demand Days</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-dune-900 dark:text-gray-100">
                  {model.insights.signals.campusDemandDays}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Supply Pressure</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-dune-900 dark:text-gray-100">
                  {supply?.supplyPressureIndex ?? 50}
                  <span className="text-sm font-medium text-gray-500">/100</span>
                </p>
              </div>
            </div>
          </Card>

          <CompsetPositionChart
            rates={chartRates}
            recommendedRate={model.compsetPosition.recommendedRate}
            p25={model.marketAnchor.compsetP25}
            median={model.marketAnchor.compsetMedian}
            p75={model.marketAnchor.compsetP75}
          />

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <PriceHeatmap
                pricing={safePricing}
                eventDates={eventDates}
                holidayDates={holidayDates}
                longWeekendDates={longWeekendDates}
                highDemandDates={highDemandDates}
                pricingReasonsByDate={pricingReasonsByDate}
                selectedDate={activeSelectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
            <div className="space-y-6">
              {anchorRecommendation ? <MultiplierBreakdown recommendation={anchorRecommendation} /> : null}
              <Card className="bg-white/95 dark:bg-neutral-900/95">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold tracking-tight">Date Explainability</h3>
                  {activeSelectedDate ? (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateSafe(activeSelectedDate, "MMM d, yyyy")}
                    </span>
                  ) : null}
                </div>
                {selectedExplainability ? (
                  <>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{selectedExplainability.headline}</p>
                    <div className="mt-4 space-y-2">
                      {sortedFactorEntries.slice(0, 6).map(([factor, detail]) => (
                        <div
                          key={factor}
                          className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 text-xs dark:border-gray-700 dark:bg-neutral-800/60"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{factorLabel(factor)}</span>
                            <span className={detail.contribution >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                              {detail.contribution >= 0 ? "+" : ""}
                              {detail.contribution.toFixed(1)}%
                            </span>
                          </div>
                          <p className="mt-1 text-gray-600 dark:text-gray-300">{detail.reason}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge tone={selectedExplainability.guardrails.minHit ? "negative" : "neutral"}>
                        Min Guardrail {selectedExplainability.guardrails.minHit ? "hit" : "clear"}
                      </Badge>
                      <Badge tone={selectedExplainability.guardrails.maxHit ? "negative" : "neutral"}>
                        Max Guardrail {selectedExplainability.guardrails.maxHit ? "hit" : "clear"}
                      </Badge>
                      <Badge tone={selectedExplainability.guardrails.dailyChangeCapped ? "gold" : "neutral"}>
                        Daily Change {selectedExplainability.guardrails.dailyChangeCapped ? "capped" : "within limit"}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Select a day from the rate calendar to inspect explainability.
                  </p>
                )}
              </Card>
            </div>
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
            <div className="space-y-6">
              <ParitySummaryCard parity={parity} directRate={directRate} />
              <EventsList events={model.events} limit={5} />
            </div>
          </div>

          <WeatherWidget weather={model.weather} />
        </>
      ) : null}

      {activeNav === "calendar" ? (
        <>
          <PriceHeatmap
            pricing={safePricing}
            eventDates={eventDates}
            holidayDates={holidayDates}
            longWeekendDates={longWeekendDates}
            highDemandDates={highDemandDates}
            pricingReasonsByDate={pricingReasonsByDate}
            selectedDate={activeSelectedDate}
            onSelectDate={setSelectedDate}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <HistoricalTrendChart history={history} />
            <PriceLineChart data={scopedPricing} />
          </div>
          {history ? (
            <Card className="bg-white/95 dark:bg-neutral-900/95">
              <h3 className="text-lg font-semibold tracking-tight">History Summary</h3>
              <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2 dark:text-gray-300">
                <p>
                  Avg recommended rate:{" "}
                  <span className="font-semibold tabular-nums">${safeNumber(history.summary.recommendedAvg).toFixed(0)}</span>
                </p>
                <p>
                  Recommended trend:{" "}
                  <span className="font-semibold tabular-nums">{safeNumber(history.summary.recommendedTrendPct).toFixed(1)}%</span>
                </p>
                <p>
                  Avg compset median:{" "}
                  <span className="font-semibold tabular-nums">${safeNumber(history.summary.compsetAvg).toFixed(0)}</span>
                </p>
                <p>
                  Volatility:{" "}
                  <span className="font-semibold tabular-nums">{safeNumber(history.summary.volatilityPct).toFixed(1)}%</span>
                </p>
              </div>
            </Card>
          ) : null}
          <div className="grid gap-6 xl:grid-cols-2">
            <OccupancyBarChart data={scopedPricing} />
            <ParitySummaryCard parity={parity} directRate={directRate} />
          </div>
        </>
      ) : null}

      {activeNav === "events" ? <EventsList events={model.events} limit={Math.max(6, pricePeriod)} /> : null}

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
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Live status of Hotels, Events, Holidays, Weather, Trends, Flights, PMS, and University pipelines.</p>
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
            <h3 className="text-lg font-bold tracking-tight">Operations Snapshot</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              PMS mode, supply pressure, portfolio rollup, and anomaly monitoring.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">PMS Mode</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{pmsHealth?.activeMode ?? paceSource}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {pmsHealth?.providers.find((provider) => provider.provider === "cloudbeds")?.message ??
                    "Cloudbeds is disabled in this deployment; simulated PMS is active."}
                </p>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Last sync: {pmsSyncAt ? new Date(pmsSyncAt).toLocaleString() : "n/a"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">STR Supply Source</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {supply?.supplyPressureIndex ?? 50}/100
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {supply
                    ? `Fallback Proxy • ${supply.trend}`
                    : "Run analysis to refresh supply pressure."}
                </p>
                <div className="mt-1">
                  <Badge tone="gold">
                    {supplySource ?? "fallback_proxy"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Portfolio</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {portfolio?.propertyCount ?? 0} properties
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {portfolio
                    ? `ADR $${safeNumber(portfolio.totals.adrAvg).toFixed(0)} • RevPAR $${safeNumber(portfolio.totals.revparAvg).toFixed(0)}`
                    : "Portfolio rollup appears after analysis history exists."}
                </p>
              </div>
            </div>

	            <div className="mt-4 grid gap-3 md:grid-cols-2">
	              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Revenue Analytics</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {revenueAnalytics
                    ? `ADR trend ${safeNumber(revenueAnalytics.summary.adrTrendPct).toFixed(1)}% • RevPAR trend ${safeNumber(revenueAnalytics.summary.revparTrendPct).toFixed(1)}%`
                    : "Run analysis to build ADR/RevPAR trend analytics."}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Pace Anomalies</p>
	                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
	                  {anomalies
	                    ? `${anomalies.anomalies.length} anomaly ${anomalies.anomalies.length === 1 ? "flag" : "flags"} in ${anomalies.windowDays} days`
	                    : "No anomaly baseline yet. Build history with repeated analysis runs."}
	                </p>
	              </div>
	            </div>
	          </div>

          <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-card dark:border-gray-700 dark:bg-neutral-900/90">
            <h3 className="text-lg font-bold tracking-tight">Rate Publish Console</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Dry-run only in this deployment. Live publish and rollback are disabled.
            </p>
            <div className="mt-4">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Notes</span>
                <input
                  type="text"
                  value={pushNotes}
                  onChange={(event) => setPushNotes(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-neutral-800 dark:text-gray-100"
                  placeholder="Optional deployment note"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={triggerRatePush}
                className="rounded-lg border border-gold-300 bg-gold-100 px-3 py-1.5 text-xs font-semibold text-gold-900 transition hover:bg-gold-200 dark:border-gold-700/50 dark:bg-gold-900/30 dark:text-gold-300"
              >
                Run dry-run push
              </button>
            </div>
            {createRatePushMutation.error ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {(createRatePushMutation.error as Error).message}
              </p>
            ) : null}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Job ID</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {ratePushJobsQuery.data?.jobs?.length ? (
                    ratePushJobsQuery.data.jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="cursor-pointer border-t border-gray-100 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-neutral-800/60"
                        onClick={() => setSelectedJobId(job.id)}
                      >
                        <td className="px-3 py-2 font-medium tabular-nums">#{job.id}</td>
                        <td className="px-3 py-2 uppercase">{job.mode}</td>
                        <td className="px-3 py-2">
                          <Badge tone={job.status === "completed" || job.status === "rolled_back" ? "positive" : job.status === "failed" ? "negative" : "gold"}>
                            {job.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                          {new Date(job.requestedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400" colSpan={4}>
                        No push jobs yet for this property.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {selectedJobQuery.data ? (
              <div className="mt-3 rounded-lg border border-gray-200/70 bg-gray-50/80 p-3 text-xs dark:border-gray-700 dark:bg-neutral-800/60">
                <p className="font-semibold">Selected job #{selectedJobQuery.data.job.id}</p>
                <p className="mt-1 text-gray-600 dark:text-gray-300">
                  {selectedJobQuery.data.items.filter((item) => item.status === "failed").length} failed of{" "}
                  {selectedJobQuery.data.items.length} items.
                </p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-card dark:border-gray-700 dark:bg-neutral-900/90">
              <h3 className="text-lg font-bold tracking-tight">Property Registry</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Server-backed property records power scoped analysis and dry-run rate operations.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Property</th>
                      <th className="px-3 py-2">City</th>
                      <th className="px-3 py-2">Rooms</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(propertiesQuery.data?.properties ?? []).map((property) => (
                      <tr key={property.propertyId} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">
                          <p className="font-medium">{property.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{property.propertyId}</p>
                        </td>
                        <td className="px-3 py-2">{property.cityName}, {property.countryCode}</td>
                        <td className="px-3 py-2 tabular-nums">{property.totalRooms}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              updatePropertyMutation.mutate({
                                propertyId: property.propertyId,
                                totalRooms: property.totalRooms + 1
                              })
                            }
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                          >
                            +1 room
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <input
                  type="text"
                  value={newProperty.propertyId}
                  onChange={(event) => setNewProperty((prev) => ({ ...prev, propertyId: event.target.value }))}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-100"
                  placeholder="property-id"
                />
                <input
                  type="text"
                  value={newProperty.name}
                  onChange={(event) => setNewProperty((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-100"
                  placeholder="Name"
                />
                <input
                  type="text"
                  value={newProperty.cityName}
                  onChange={(event) => setNewProperty((prev) => ({ ...prev, cityName: event.target.value }))}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-100"
                  placeholder="City"
                />
                <button
                  type="button"
                  onClick={() =>
                    createPropertyMutation.mutate({
                      propertyId: newProperty.propertyId,
                      name: newProperty.name,
                      cityName: newProperty.cityName,
                      countryCode: newProperty.countryCode
                    })
                  }
                  className="rounded-lg bg-amber-500 px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                >
                  Create property
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 shadow-card dark:border-gray-700 dark:bg-neutral-900/90">
              <h3 className="text-lg font-bold tracking-tight">Compset Suggestions</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Deterministic clustering suggests compset peers by geo, rate-band, and demand fit.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUseSuggestedCompset(true)}
                  className="rounded-md border border-gold-300 bg-gold-100 px-2 py-1 text-xs font-semibold text-gold-900 transition hover:bg-gold-200 dark:border-gold-700/50 dark:bg-gold-900/30 dark:text-gold-300"
                >
                  Apply to next analysis
                </button>
                {compsetSuggestionVersion ? <Badge tone="gold">Active {compsetSuggestionVersion}</Badge> : null}
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Hotel</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compsetSuggestionsQuery.data?.suggestions?.length ? (
                      compsetSuggestionsQuery.data.suggestions.map((suggestion) => (
                        <tr key={suggestion.hotelId} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2">
                            <p className="font-medium">{suggestion.hotelName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{suggestion.explanation}</p>
                          </td>
                          <td className="px-3 py-2 tabular-nums">{suggestion.score}</td>
                          <td className="px-3 py-2">
                            <Badge tone={suggestion.confidence === "high" ? "positive" : suggestion.confidence === "medium" ? "gold" : "neutral"}>
                              {suggestion.confidence}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-3 text-gray-500 dark:text-gray-400" colSpan={3}>
                          {compsetSuggestionsQuery.isError
                            ? "No suggestions yet. Run analysis to create compset history."
                            : "Suggestions will appear after analysis data is available."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {isMakcorpsDegraded ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-700/40 dark:bg-amber-900/20">
              <h3 className="text-lg font-bold tracking-tight text-amber-900 dark:text-amber-200">Makcorps Diagnostics Recommended</h3>
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                Compset is running on fallback. Check diagnostics at <code>/api/providers/makcorps/diagnostics</code> for the latest recommended mode and endpoint access details.
              </p>
            </div>
          ) : null}

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
                    providerUsageRows.map((row) => {
                      const status = computeQuotaState(row);
                      return (
                        <tr key={row.provider} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 font-medium uppercase">{row.provider}</td>
                          <td className="px-3 py-2 tabular-nums">
                            {safeNumber(row.calls)}/{safeNumber(row.quota)} ({safeNumber(row.percentUsed).toFixed(1)}%)
                          </td>
                          <td className="px-3 py-2 tabular-nums">{safeNumber(row.remaining)}</td>
                          <td className="px-3 py-2">
                            <Badge tone={quotaTone(status)} className="uppercase">
                              {status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.recommendation}</td>
                        </tr>
                      );
                    })
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

          <ParitySummaryCard parity={parity} directRate={directRate} />
        </div>
      ) : null}
    </div>
  );
}
