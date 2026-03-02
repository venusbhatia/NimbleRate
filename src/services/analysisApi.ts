import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { HotelType } from "../types/common";
import type { MarketAnalysisResponse } from "../types/dashboard";

export interface MarketAnalysisParams {
  cityName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  hotelType: HotelType;
  estimatedOccupancy: number;
  adults: number;
  daysForward?: number;
  targetMarketPosition?: number;
  minPrice?: number;
  maxPrice?: number;
  totalRooms?: number;
}

export function getMarketAnalysis(params: MarketAnalysisParams) {
  return apiFetch<MarketAnalysisResponse>(apiPath("/api/market/analysis"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
