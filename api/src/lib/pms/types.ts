import type { PacePoint } from "../paceSimulator.js";

export type PmsProvider = "simulated" | "cloudbeds";
export type PmsHotelType = "city" | "business" | "leisure" | "beach" | "ski";

export interface PmsPaceRequest {
  cityName: string;
  checkInDate: string;
  daysForward: number;
  hotelType: PmsHotelType;
  totalRooms: number;
  seed?: string;
}

export interface PmsHealthStatus {
  provider: PmsProvider;
  configured: boolean;
  message: string;
}

export interface PmsAdapter {
  provider: PmsProvider;
  getPace: (request: PmsPaceRequest) => Promise<PacePoint[]>;
  health: () => Promise<PmsHealthStatus>;
}
