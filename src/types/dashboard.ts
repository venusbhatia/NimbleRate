import type { TicketmasterEvent } from "./events";
import type { WeatherDailySummary } from "./weather";
import type { PricingRecommendation } from "./pricing";

export interface DashboardKpis {
  adr: number;
  revpar: number;
  occupancy: number;
  activeMultiplier: number;
}

export interface DashboardModel {
  pricing: PricingRecommendation[];
  kpis: DashboardKpis;
  events: TicketmasterEvent[];
  weather: WeatherDailySummary[];
}
