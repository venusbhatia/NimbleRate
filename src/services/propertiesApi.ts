import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { PropertiesListResponse, PropertiesMutationResponse } from "../types/operations";

export function getProperties() {
  return apiFetch<PropertiesListResponse>(apiPath("/api/properties"));
}

export function createProperty(payload: {
  propertyId: string;
  name: string;
  countryCode: string;
  cityName: string;
  latitude?: number;
  longitude?: number;
  hotelType?: "city" | "business" | "leisure" | "beach" | "ski";
  totalRooms?: number;
  channelProvider?: string;
}) {
  return apiFetch<PropertiesMutationResponse>(apiPath("/api/properties"), {
    method: "POST",
    body: payload
  });
}

export function updateProperty(
  propertyId: string,
  payload: {
    name?: string;
    countryCode?: string;
    cityName?: string;
    latitude?: number;
    longitude?: number;
    hotelType?: "city" | "business" | "leisure" | "beach" | "ski";
    totalRooms?: number;
    channelProvider?: string;
  }
) {
  return apiFetch<PropertiesMutationResponse>(apiPath(`/api/properties/${propertyId}`), {
    method: "PATCH",
    body: payload
  });
}
