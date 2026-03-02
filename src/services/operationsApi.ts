import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type {
  PaceAnomaliesResponse,
  PmsHealthResponse,
  PortfolioSummaryResponse,
  RevenueAnalyticsResponse,
  StrSupplyResponse
} from "../types/operations";

export function getPmsHealth() {
  return apiFetch<PmsHealthResponse>(apiPath("/api/pms/health"));
}

export function getStrSupply(params: {
  cityName: string;
  countryCode: string;
  propertyId?: string;
  latitude?: number;
  longitude?: number;
  daysForward?: number;
}) {
  return apiFetch<StrSupplyResponse>(apiPath("/api/supply/str"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}

export function getPortfolioSummary(params?: { days?: number }) {
  return apiFetch<PortfolioSummaryResponse>(apiPath("/api/portfolio/summary"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}

export function getPaceAnomalies(params: {
  cityName: string;
  countryCode: string;
  propertyId?: string;
  days?: number;
}) {
  return apiFetch<PaceAnomaliesResponse>(apiPath("/api/pace/anomalies"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}

export function getRevenueAnalytics(params: {
  cityName: string;
  countryCode: string;
  propertyId?: string;
  days?: number;
}) {
  return apiFetch<RevenueAnalyticsResponse>(apiPath("/api/revenue/analytics"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
