import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { MarketHistoryResponse } from "../types/history";

export function getMarketHistory(params: {
  cityName: string;
  countryCode: string;
  days?: number;
}) {
  return apiFetch<MarketHistoryResponse>(apiPath("/api/market/history"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
