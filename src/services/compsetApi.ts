import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type {
  CompsetRatesResponse,
  CompsetSearchResponse,
  CompsetSuggestionsResponse
} from "../types/compset";

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

export function getCompsetSuggestions(params: {
  cityName: string;
  countryCode: string;
  propertyId?: string;
  latitude: number;
  longitude: number;
  maxResults?: number;
}) {
  return apiFetch<CompsetSuggestionsResponse>(apiPath("/api/compset/suggestions"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
