import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { ParitySummaryResponse } from "../types/parity";

export function getParitySummary(params: {
  cityName: string;
  countryCode: string;
  propertyId?: string;
  checkInDate: string;
  checkOutDate: string;
  directRate: number;
  tolerancePct?: number;
}) {
  return apiFetch<ParitySummaryResponse>(apiPath("/api/parity/summary"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
