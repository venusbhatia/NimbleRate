import type { TicketmasterEvent } from "./events";
import type { WeatherDailySummary } from "./weather";
import type { PricingRecommendation } from "./pricing";
import type { CompsetHotel, CompsetSummary } from "./compset";
import type { ProviderUsageSummary, UsageSummaryResponse } from "./usage";

export type DashboardApiErrorSource =
  | "hotels"
  | "offers"
  | "events"
  | "holidays"
  | "weather"
  | "analysis"
  | "usage";

export interface DashboardApiErrorDetail {
  source: DashboardApiErrorSource;
  message: string;
  status?: number;
  raw: string;
}

export interface DashboardApiErrorState {
  summary: string;
  details: DashboardApiErrorDetail[];
}

export interface ExplainabilityFactor {
  value: number;
  contribution: number;
  reason: string;
}

export interface DateExplainability {
  headline: string;
  factors: {
    occupancyRate: ExplainabilityFactor;
    dayOfWeek: ExplainabilityFactor;
    seasonality: ExplainabilityFactor;
    events: ExplainabilityFactor;
    weather: ExplainabilityFactor;
    holiday: ExplainabilityFactor;
    leadTime: ExplainabilityFactor;
  };
  guardrails: {
    minHit: boolean;
    maxHit: boolean;
    dailyChangeCapped: boolean;
  };
}

export interface AnalysisContext {
  cityName: string;
  countryCode: string;
  hotelType: "city" | "business" | "leisure" | "beach" | "ski";
  daysForward: number;
  runMode: "fallback_first";
}

export interface SelectedDateExplainability {
  date: string;
  detail: DateExplainability | null;
}

export interface DemandInsight {
  index: number;
  level: "low" | "moderate" | "high" | "peak";
  occupancySignal: number;
  eventSignal: number;
  holidaySignal: number;
  leadTimeSignal: number;
}

export interface DataQualityInsight {
  confidenceScore: number;
  availableSources: number;
  totalSources: number;
  hasApiErrors: boolean;
  missingSources: string[];
}

export interface ActionRecommendation {
  id: string;
  action: "raise" | "lower" | "hold";
  title: string;
  rationale: string;
  expectedAdrImpact: number;
  expectedRevparImpact: number;
  confidence: number;
}

export interface MarketSignalsSummary {
  eventDays: number;
  holidayDays: number;
  longWeekendDays: number;
  weatherRiskDays: number;
  highDemandDays: number;
}

export interface SourceHealthRow {
  source: "Hotels" | "Events" | "Holidays" | "Weather";
  status: "ok" | "loading" | "error";
  errorSummary?: string;
  lastUpdated?: string;
}

export interface DashboardKpis {
  adr: number;
  revpar: number;
  occupancy: number;
  activeMultiplier: number;
  adrDeltaPct: number;
  revparDeltaPct: number;
  occupancyDeltaPct: number;
  activeMultiplierDelta: number;
  demandPressureIndex: number;
  dataConfidence: number;
}

export interface DashboardModel {
  pricing: PricingRecommendation[];
  kpis: DashboardKpis;
  events: TicketmasterEvent[];
  weather: WeatherDailySummary[];
  marketAnchor: {
    anchorRate: number;
    compsetMedian: number;
    compsetP25: number;
    compsetP75: number;
    targetMarketPosition: number;
    source: "makcorps" | "amadeus" | "fallback";
  };
  compsetPosition: {
    recommendedRate: number;
    deltaVsMedian: number;
    percentileBand: "below_p25" | "mid_band" | "above_p75";
  };
  recommendationConfidence: {
    level: "high" | "medium" | "low";
    score: number;
    reason: string;
  };
  providerUsage: ProviderUsageSummary[];
  compset: {
    source: "makcorps" | "amadeus" | "fallback";
    hotels: CompsetHotel[];
    summary: CompsetSummary;
  };
  insights: {
    demand: DemandInsight;
    dataQuality: DataQualityInsight;
    actions: ActionRecommendation[];
    signals: MarketSignalsSummary;
  };
}

export interface MarketAnalysisResponse {
  generatedAt: string;
  warnings: string[];
  analysisContext: AnalysisContext;
  fallbacksUsed: string[];
  usage: UsageSummaryResponse;
  model: DashboardModel;
  sourceHealth: SourceHealthRow[];
  pricingReasonsByDate: Record<string, string[]>;
  explainabilityByDate: Record<string, DateExplainability>;
  eventDates: string[];
  holidayDates: string[];
  longWeekendDates: string[];
  highDemandDates: string[];
}
