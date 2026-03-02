import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { PredictHQEventsResponse } from "../types/predicthq";

export function getPredictHqEvents(params: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  radiusKm?: number;
  rankGte?: number;
}) {
  return apiFetch<PredictHQEventsResponse>(apiPath("/api/events/predicthq"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}
