import type { TicketmasterEvent } from "./events";
import type { WeatherDailySummary } from "./weather";
import type { PricingRecommendation } from "./pricing";

export type DashboardApiErrorSource = "hotels" | "offers" | "events" | "holidays" | "weather";

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
  insights: {
    demand: DemandInsight;
    dataQuality: DataQualityInsight;
    actions: ActionRecommendation[];
    signals: MarketSignalsSummary;
  };
}
