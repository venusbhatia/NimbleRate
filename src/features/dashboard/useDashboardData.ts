import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { getMarketAnalysis } from "../../services/analysisApi";
import { ApiError } from "../../services/apiClient";
import { getMarketHistory } from "../../services/historyApi";
import { getParitySummary } from "../../services/parityApi";
import { getProviderUsageSummary } from "../../services/usageApi";
import { useSearchParams } from "../search/useSearchParams";
import type {
  AnalysisContext,
  DateExplainability,
  DashboardApiErrorDetail,
  DashboardApiErrorSource,
  DashboardApiErrorState,
  DashboardModel,
  SourceHealthRow
} from "../../types/dashboard";
import type { PricingRecommendation } from "../../types/pricing";
import type { LongWeekend, PublicHoliday } from "../../types/holidays";
import type { MarketHistoryResponse } from "../../types/history";
import type { ParitySummaryResponse } from "../../types/parity";

function normalizeEventDate(rawDate: string) {
  if (rawDate.includes("T")) {
    return rawDate.slice(0, 10);
  }
  return rawDate;
}

function stringifyRawError(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "No error details provided.";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toDashboardApiError(source: DashboardApiErrorSource, error: unknown): DashboardApiErrorDetail {
  if (error instanceof ApiError) {
    const detailsMessage =
      error.details &&
      typeof error.details === "object" &&
      "message" in error.details &&
      typeof (error.details as { message?: unknown }).message === "string"
        ? ((error.details as { message: string }).message ?? "").trim()
        : "";

    return {
      source,
      status: error.status,
      message: detailsMessage || error.message || `Request failed: ${error.status}`,
      raw: stringifyRawError(error.details)
    };
  }

  if (error instanceof Error) {
    return {
      source,
      message: error.message || "Unknown error",
      raw: stringifyRawError({ name: error.name, message: error.message })
    };
  }

  return {
    source,
    message: "Unknown error",
    raw: stringifyRawError(error)
  };
}

export function isAnalysisRequiredError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) {
    return false;
  }

  if (error.details && typeof error.details === "object" && "details" in error.details) {
    const nested = (error.details as { details?: unknown }).details;
    if (nested && typeof nested === "object" && "code" in nested) {
      return String((nested as { code?: unknown }).code) === "ANALYSIS_REQUIRED";
    }
  }

  if (error.details && typeof error.details === "object" && "code" in error.details) {
    return String((error.details as { code?: unknown }).code) === "ANALYSIS_REQUIRED";
  }

  return false;
}

function queryStatus(
  isLoading: boolean,
  isFetching: boolean,
  hasError: boolean
): SourceHealthRow["status"] {
  if (hasError) return "error";
  if (isLoading || isFetching) return "loading";
  return "ok";
}

function createPlaceholderPricing(startDate: string, days = 30): PricingRecommendation[] {
  const baseDate = parseISO(startDate);
  const isFallbackDateValid = Number.isFinite(baseDate.getTime());
  const safeBaseDate = isFallbackDateValid ? baseDate : new Date();

  return Array.from({ length: days }).map((_, idx) => {
    const date = format(addDays(safeBaseDate, idx), "yyyy-MM-dd");
    return {
      date,
      baseRate: 220,
      finalRate: 220,
      finalMultiplier: 1,
      rawMultiplier: 1,
      factors: {
        occupancyRate: 1,
        dayOfWeek: 1,
        seasonality: 1,
        events: 1,
        weather: 1,
        holiday: 1,
        leadTime: 1,
        searchDemand: 1,
        travelIntent: 1,
        campusDemand: 1
      }
    };
  });
}

function createFallbackModel(params: ReturnType<typeof useSearchParams>): DashboardModel {
  const placeholderPricing = createPlaceholderPricing(params.checkInDate);

  return {
    pricing: placeholderPricing,
    events: [],
    weather: [],
    kpis: {
      adr: 220,
      revpar: 220 * (params.estimatedOccupancy / 100),
      occupancy: params.estimatedOccupancy,
      activeMultiplier: 1,
      adrDeltaPct: 0,
      revparDeltaPct: 0,
      occupancyDeltaPct: 0,
      activeMultiplierDelta: 0,
      demandPressureIndex: Math.round(params.estimatedOccupancy * 0.6),
      dataConfidence: 25
    },
    marketAnchor: {
      anchorRate: 220,
      compsetMedian: 220,
      compsetP25: 200,
      compsetP75: 240,
      targetMarketPosition: 0.5,
      source: "fallback"
    },
    compsetPosition: {
      recommendedRate: 220,
      deltaVsMedian: 0,
      percentileBand: "mid_band"
    },
    recommendationConfidence: {
      level: "low",
      score: 25,
      reason: "Run analysis to load market anchor and demand signals."
    },
    providerUsage: [],
    compset: {
      source: "fallback",
      hotels: [],
      summary: {
        medianRate: 220,
        averageRate: 220,
        sampleSize: 0
      }
    },
    insights: {
      demand: {
        index: Math.round(params.estimatedOccupancy * 0.6),
        level: "low",
        occupancySignal: params.estimatedOccupancy,
        eventSignal: 0,
        holidaySignal: 0,
        leadTimeSignal: 0
      },
      dataQuality: {
        confidenceScore: 25,
        availableSources: 0,
        totalSources: 8,
        hasApiErrors: false,
        missingSources: ["Hotels", "Events", "Holidays", "Weather", "Trends", "Flights", "PMS", "University"]
      },
      actions: [
        {
          id: "run-analysis",
          action: "hold",
          title: "Run market analysis",
          rationale: "Click Run Analysis to pull compset, events, holidays, and weather signals.",
          expectedAdrImpact: 0,
          expectedRevparImpact: 0,
          confidence: 25
        }
      ],
      signals: {
        eventDays: 0,
        holidayDays: 0,
        longWeekendDays: 0,
        weatherRiskDays: 0,
        highDemandDays: 0,
        searchMomentumIndex: 50,
        flightDemandIndex: 50,
        campusDemandDays: 0
      }
    }
  };
}

export function normalizePublicHolidayEntries(input: unknown): PublicHoliday[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter((entry) => typeof entry.date === "string")
    .map((entry) => ({
      date: String(entry.date),
      localName: typeof entry.localName === "string" ? entry.localName : "",
      name: typeof entry.name === "string" ? entry.name : "",
      countryCode: typeof entry.countryCode === "string" ? entry.countryCode : "",
      global: Boolean(entry.global),
      counties: Array.isArray(entry.counties) ? entry.counties.filter((value): value is string => typeof value === "string") : null,
      types: Array.isArray(entry.types) ? entry.types.filter((value): value is string => typeof value === "string") : [],
      launchYear: typeof entry.launchYear === "number" ? entry.launchYear : null
    }));
}

export function normalizeLongWeekendEntries(input: unknown): LongWeekend[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter((entry) => typeof entry.startDate === "string" && typeof entry.endDate === "string")
    .map((entry) => ({
      startDate: String(entry.startDate),
      endDate: String(entry.endDate),
      dayCount: typeof entry.dayCount === "number" ? entry.dayCount : 0,
      needBridgeDay: Boolean(entry.needBridgeDay)
    }));
}

export function useDashboardData() {
  const params = useSearchParams();

  const analysisQuery = useQuery({
    queryKey: [
      "market-analysis",
      params.searchToken,
      params.cityName,
      params.cityCode,
      params.countryCode,
      params.latitude,
      params.longitude,
      params.checkInDate,
      params.checkOutDate,
      params.adults,
      params.hotelType,
      params.estimatedOccupancy
    ],
    enabled: params.searchToken > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      getMarketAnalysis({
        cityName: params.cityName,
        cityCode: params.cityCode ?? undefined,
        countryCode: params.countryCode,
        latitude: params.latitude,
        longitude: params.longitude,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        adults: params.adults,
        hotelType: params.hotelType,
        estimatedOccupancy: params.estimatedOccupancy,
        daysForward: 30
      })
  });

  const usageSummaryQuery = useQuery({
    queryKey: ["provider-usage-summary"],
    staleTime: 30_000,
    queryFn: getProviderUsageSummary
  });

  const historyQuery = useQuery({
    queryKey: ["market-history", params.searchToken, params.cityName, params.countryCode],
    enabled: params.searchToken > 0,
    staleTime: 60_000,
    queryFn: async () =>
      getMarketHistory({
        cityName: params.cityName,
        countryCode: params.countryCode,
        days: 30
      })
  });

  const parityQuery = useQuery({
    queryKey: [
      "parity-summary",
      params.searchToken,
      params.cityName,
      params.countryCode,
      params.checkInDate,
      params.checkOutDate,
      params.directRate
    ],
    enabled: params.searchToken > 0,
    staleTime: 60_000,
    queryFn: async () =>
      getParitySummary({
        cityName: params.cityName,
        countryCode: params.countryCode,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        directRate: params.directRate
      })
  });

  const apiError = useMemo<DashboardApiErrorState | null>(() => {
    const details: DashboardApiErrorDetail[] = [];

    if (analysisQuery.error) details.push(toDashboardApiError("analysis", analysisQuery.error));
    if (usageSummaryQuery.error) details.push(toDashboardApiError("usage", usageSummaryQuery.error));
    if (historyQuery.error && !isAnalysisRequiredError(historyQuery.error)) {
      details.push(toDashboardApiError("history", historyQuery.error));
    }
    if (parityQuery.error && !isAnalysisRequiredError(parityQuery.error)) {
      details.push(toDashboardApiError("parity", parityQuery.error));
    }

    if (!details.length) return null;

    return {
      summary: "Something went wrong while loading API data.",
      details
    };
  }, [analysisQuery.error, usageSummaryQuery.error, historyQuery.error, parityQuery.error]);

  const auxiliaryHints = useMemo(() => {
    const hints: string[] = [];

    if (isAnalysisRequiredError(historyQuery.error)) {
      hints.push("Historical trend data will appear after at least one completed analysis run for this market.");
    }

    if (isAnalysisRequiredError(parityQuery.error)) {
      hints.push("Parity summary requires a compset snapshot for this exact date range. Run analysis for these dates.");
    }

    return hints;
  }, [historyQuery.error, parityQuery.error]);

  const fallbackModel = useMemo(() => createFallbackModel(params), [params]);

  const model = useMemo<DashboardModel>(() => {
    if (!analysisQuery.data) {
      return {
        ...fallbackModel,
        providerUsage: usageSummaryQuery.data?.providers ?? fallbackModel.providerUsage
      };
    }

    return {
      ...analysisQuery.data.model,
      providerUsage: usageSummaryQuery.data?.providers ?? analysisQuery.data.model.providerUsage
    };
  }, [analysisQuery.data, fallbackModel, usageSummaryQuery.data?.providers]);

  const history = useMemo<MarketHistoryResponse | null>(() => {
    if (historyQuery.data && !isAnalysisRequiredError(historyQuery.error)) {
      return historyQuery.data;
    }
    return null;
  }, [historyQuery.data, historyQuery.error]);

  const parity = useMemo<ParitySummaryResponse | null>(() => {
    if (parityQuery.data && !isAnalysisRequiredError(parityQuery.error)) {
      return parityQuery.data;
    }
    return null;
  }, [parityQuery.data, parityQuery.error]);

  const eventDates = useMemo(() => {
    if (analysisQuery.data?.eventDates) {
      return new Set(analysisQuery.data.eventDates.map(normalizeEventDate));
    }
    return new Set(model.events.map((event) => normalizeEventDate(event.date)));
  }, [analysisQuery.data?.eventDates, model.events]);

  const holidayDates = useMemo(() => {
    if (analysisQuery.data?.holidayDates) {
      return new Set(analysisQuery.data.holidayDates);
    }
    return new Set<string>();
  }, [analysisQuery.data?.holidayDates]);

  const longWeekendDateSet = useMemo(() => {
    if (analysisQuery.data?.longWeekendDates) {
      return new Set(analysisQuery.data.longWeekendDates);
    }
    return new Set<string>();
  }, [analysisQuery.data?.longWeekendDates]);

  const highDemandDates = useMemo(() => {
    if (analysisQuery.data?.highDemandDates) {
      return new Set(analysisQuery.data.highDemandDates);
    }
    return new Set(model.pricing.filter((day) => day.finalMultiplier >= 1.25).map((day) => day.date));
  }, [analysisQuery.data?.highDemandDates, model.pricing]);

  const pricingReasonsByDate = useMemo(() => {
    const map = new Map<string, string[]>();

    if (analysisQuery.data?.pricingReasonsByDate) {
      Object.entries(analysisQuery.data.pricingReasonsByDate).forEach(([date, reasons]) => {
        map.set(date, Array.isArray(reasons) ? reasons : ["Market baseline conditions."]);
      });
      return map;
    }

    model.pricing.forEach((day) => {
      map.set(day.date, ["Run analysis to view full explainability."]);
    });

    return map;
  }, [analysisQuery.data?.pricingReasonsByDate, model.pricing]);

  const explainabilityByDate = useMemo(() => {
    const map = new Map<string, DateExplainability>();

    if (analysisQuery.data?.explainabilityByDate) {
      Object.entries(analysisQuery.data.explainabilityByDate).forEach(([date, detail]) => {
        map.set(date, detail);
      });
      return map;
    }

    model.pricing.forEach((day) => {
      map.set(day.date, {
        headline: "Run analysis to load full date-level explainability.",
        factors: {
          occupancyRate: { value: 1, contribution: 0, reason: "Run analysis for live pace impact." },
          dayOfWeek: { value: 1, contribution: 0, reason: "Run analysis for day-of-week signal." },
          seasonality: { value: 1, contribution: 0, reason: "Run analysis for seasonality signal." },
          events: { value: 1, contribution: 0, reason: "Run analysis for event impact." },
          weather: { value: 1, contribution: 0, reason: "Run analysis for weather impact." },
          holiday: { value: 1, contribution: 0, reason: "Run analysis for holiday impact." },
          leadTime: { value: 1, contribution: 0, reason: "Run analysis for lead-time impact." },
          searchDemand: { value: 1, contribution: 0, reason: "Run analysis for search-demand impact." },
          travelIntent: { value: 1, contribution: 0, reason: "Run analysis for flight-demand impact." },
          campusDemand: { value: 1, contribution: 0, reason: "Run analysis for university-demand impact." }
        },
        guardrails: {
          minHit: false,
          maxHit: false,
          dailyChangeCapped: false
        }
      });
    });

    return map;
  }, [analysisQuery.data?.explainabilityByDate, model.pricing]);

  const analysisContext = useMemo<AnalysisContext>(() => {
    if (analysisQuery.data?.analysisContext) {
      return analysisQuery.data.analysisContext;
    }

    return {
      cityName: params.cityName,
      countryCode: params.countryCode,
      hotelType: params.hotelType,
      daysForward: 30,
      runMode: "fallback_first",
      phase: "phase2_wave1",
      pmsMode: "simulated"
    };
  }, [analysisQuery.data?.analysisContext, params.cityName, params.countryCode, params.hotelType]);

  const sourceHealth = useMemo<SourceHealthRow[]>(() => {
    if (analysisQuery.data?.sourceHealth?.length) {
      return analysisQuery.data.sourceHealth;
    }

    const notRunSummary = params.searchToken === 0 ? "Run analysis to load live source status." : undefined;

    return [
      {
        source: "Hotels",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "Events",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "Holidays",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "Weather",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "Trends",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "Flights",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "PMS",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      },
      {
        source: "University",
        status: queryStatus(analysisQuery.isLoading, analysisQuery.isFetching, Boolean(analysisQuery.error)),
        errorSummary: analysisQuery.error ? toDashboardApiError("analysis", analysisQuery.error).message : notRunSummary
      }
    ];
  }, [analysisQuery.data?.sourceHealth, analysisQuery.error, analysisQuery.isFetching, analysisQuery.isLoading, params.searchToken]);

  return {
    model,
    apiError,
    warnings: [...(analysisQuery.data?.warnings ?? []), ...auxiliaryHints],
    analysisContext,
    fallbacksUsed: analysisQuery.data?.fallbacksUsed ?? [],
    usageSummary: usageSummaryQuery.data,
    history,
    parity,
    hasRunAnalysis: params.searchToken > 0,
    eventDates,
    holidayDates,
    longWeekendDates: longWeekendDateSet,
    highDemandDates,
    pricingReasonsByDate,
    explainabilityByDate,
    sourceHealth,
    isLoading: params.searchToken > 0 && analysisQuery.isLoading,
    isFetching:
      analysisQuery.isFetching ||
      usageSummaryQuery.isFetching ||
      historyQuery.isFetching ||
      parityQuery.isFetching
  };
}
