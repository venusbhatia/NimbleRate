import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type {
  AmadeusHotelListResponse,
  AmadeusHotelOffersResponse,
  AmadeusHotelSentimentsResponse
} from "../types/amadeus";

export async function getHotelsByCity(params: {
  cityCode: string;
  radius?: number;
  radiusUnit?: "KM" | "MILE";
  amenities?: string;
  ratings?: string;
  hotelSource?: "ALL" | "BEDBANK" | "DIRECTCHAIN";
}) {
  return apiFetch<AmadeusHotelListResponse>(apiPath("/api/hotels/by-city"), {
    params
  });
}

export async function getHotelsByGeocode(params: {
  latitude: number;
  longitude: number;
  radius?: number;
  radiusUnit?: "KM" | "MILE";
  amenities?: string;
  ratings?: string;
  hotelSource?: "ALL" | "BEDBANK" | "DIRECTCHAIN";
}) {
  return apiFetch<AmadeusHotelListResponse>(apiPath("/api/hotels/by-geocode"), {
    params
  });
}

export async function getHotelOffers(params: {
  hotelIds: string;
  adults: number;
  checkInDate: string;
  checkOutDate: string;
  roomQuantity?: number;
  currency?: string;
  priceRange?: string;
  boardType?: "ROOM_ONLY" | "BREAKFAST" | "HALF_BOARD" | "FULL_BOARD" | "ALL_INCLUSIVE";
  bestRateOnly?: boolean;
}) {
  return apiFetch<AmadeusHotelOffersResponse>(apiPath("/api/hotels/offers"), {
    params
  });
}

export async function confirmOfferPrice(offerId: string) {
  return apiFetch<AmadeusHotelOffersResponse>(apiPath(`/api/hotels/offers/${offerId}`));
}

export async function getHotelSentiments(hotelIds: string) {
  return apiFetch<AmadeusHotelSentimentsResponse>(apiPath("/api/hotels/sentiments"), {
    params: { hotelIds }
  });
}

export async function autocompleteHotels(keyword: string) {
  return apiFetch<{ data: Array<{ name: string; hotelId: string }> }>(apiPath("/api/hotels/autocomplete"), {
    params: { keyword }
  });
}
