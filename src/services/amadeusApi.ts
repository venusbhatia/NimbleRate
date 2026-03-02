import { apiFetch } from "./apiClient";
import type {
  AmadeusHotelListResponse,
  AmadeusHotelOffersResponse,
  AmadeusHotelSentimentsResponse,
  AmadeusTokenResponse
} from "../types/amadeus";

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

function getAmadeusCredentials() {
  const apiKey = import.meta.env.VITE_AMADEUS_API_KEY;
  const apiSecret = import.meta.env.VITE_AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Missing Amadeus credentials. Set VITE_AMADEUS_API_KEY and VITE_AMADEUS_API_SECRET.");
  }

  return { apiKey, apiSecret };
}

export async function getAmadeusAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const { apiKey, apiSecret } = getAmadeusCredentials();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: apiSecret
  });

  const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Amadeus token request failed (${response.status})`);
  }

  const tokenData = (await response.json()) as AmadeusTokenResponse;

  tokenCache = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000
  };

  return tokenData.access_token;
}

async function withAuthHeaders() {
  const token = await getAmadeusAccessToken();
  return { Authorization: `Bearer ${token}` };
}

export async function getHotelsByCity(params: {
  cityCode: string;
  radius?: number;
  radiusUnit?: "KM" | "MILE";
  amenities?: string;
  ratings?: string;
  hotelSource?: "ALL" | "BEDBANK" | "DIRECTCHAIN";
}) {
  return apiFetch<AmadeusHotelListResponse>(`${AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-city`, {
    headers: await withAuthHeaders(),
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
  return apiFetch<AmadeusHotelListResponse>(`${AMADEUS_BASE_URL}/v1/reference-data/locations/hotels/by-geocode`, {
    headers: await withAuthHeaders(),
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
  return apiFetch<AmadeusHotelOffersResponse>(`${AMADEUS_BASE_URL}/v3/shopping/hotel-offers`, {
    headers: await withAuthHeaders(),
    params
  });
}

export async function confirmOfferPrice(offerId: string) {
  return apiFetch<AmadeusHotelOffersResponse>(`${AMADEUS_BASE_URL}/v3/shopping/hotel-offers/${offerId}`, {
    headers: await withAuthHeaders()
  });
}

export async function getHotelSentiments(hotelIds: string) {
  return apiFetch<AmadeusHotelSentimentsResponse>(`${AMADEUS_BASE_URL}/v2/e-reputation/hotel-sentiments`, {
    headers: await withAuthHeaders(),
    params: { hotelIds }
  });
}

export async function autocompleteHotels(keyword: string) {
  return apiFetch<{ data: Array<{ name: string; hotelId: string }> }>(`${AMADEUS_BASE_URL}/v1/reference-data/locations/hotel`, {
    headers: await withAuthHeaders(),
    params: {
      keyword,
      subType: "HOTEL_LEISURE"
    }
  });
}
