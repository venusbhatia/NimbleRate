import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { PaceSimulationResponse } from "../types/pace";
import type { HotelType } from "../types/common";

export function simulateBookingPace(payload: {
  totalRooms: number;
  daysForward: number;
  hotelType: HotelType;
  seed?: string;
  startDate?: string;
}) {
  return apiFetch<PaceSimulationResponse>(apiPath("/api/pace/simulate"), {
    method: "POST",
    body: payload
  });
}
