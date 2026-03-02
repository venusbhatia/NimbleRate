import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { CompsetRatesResponse, CompsetSearchResponse } from "../types/compset";

export function searchCompset(params: {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  maxResults?: number;
}) {
  return apiFetch<CompsetSearchResponse>(apiPath("/api/compset/search"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}

export function getCompsetRates(params: {
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
}) {
  return apiFetch<CompsetRatesResponse>(apiPath("/api/compset/rates"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
