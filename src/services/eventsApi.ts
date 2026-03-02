import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { TicketmasterDiscoveryResponse, TicketmasterEvent, TicketmasterEventsPage, TicketmasterRawEvent } from "../types/events";

const TICKETMASTER_BASE_URL = "https://app.ticketmaster.com/discovery/v2";

function getTicketmasterApiKey() {
  const apiKey = import.meta.env.VITE_TICKETMASTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing Ticketmaster API key. Set VITE_TICKETMASTER_API_KEY.");
  }

  return apiKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTicketmasterEvent(raw: Record<string, any>): TicketmasterEvent {
  const venue = raw?._embedded?.venues?.[0];
  const classification = raw?.classifications?.[0];
  const priceRange = raw?.priceRanges?.[0];
  const attractionTotal = raw?._embedded?.attractions?.[0]?.upcomingEvents?._total ?? 0;

  return {
    id: raw.id,
    name: raw.name,
    date: raw?.dates?.start?.localDate ?? raw?.dates?.start?.dateTime ?? "",
    status: raw?.dates?.status?.code ?? "unknown",
    segment: classification?.segment?.name,
    genre: classification?.genre?.name,
    minPrice: priceRange?.min,
    maxPrice: priceRange?.max,
    currency: priceRange?.currency,
    venueName: venue?.name,
    venueLatitude: venue?.location?.latitude ? Number(venue.location.latitude) : undefined,
    venueLongitude: venue?.location?.longitude ? Number(venue.location.longitude) : undefined,
    popularityScore: Number(attractionTotal) + (Number(priceRange?.max) || 0) / 25
  };
}

export async function getEventsNearLocation(params: {
  latitude: number;
  longitude: number;
  radius?: number;
  unit?: "miles" | "km";
  startDateTime?: string;
  endDateTime?: string;
  size?: number;
  page?: number;
  sort?: "date,asc" | "date,desc" | "relevance,desc" | "distance,asc" | "name,asc";
  classificationName?: string;
}) {
  const apiKey = getTicketmasterApiKey();
  const geoPoint = ngeohash.encode(params.latitude, params.longitude, 7);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await apiFetch<Record<string, any>>(`${TICKETMASTER_BASE_URL}/events.json`, {
    params: {
      apikey: apiKey,
      geoPoint,
      latlong: `${params.latitude},${params.longitude}`,
      radius: params.radius ?? 25,
      unit: params.unit ?? "miles",
      sort: params.sort ?? "date,asc",
      size: params.size ?? 50,
      page: params.page ?? 0,
      startDateTime: params.startDateTime,
      endDateTime: params.endDateTime,
      classificationName: params.classificationName
    }
  });

  const events = (result?._embedded?.events ?? []).map(normalizeTicketmasterEvent);

  const mapped: TicketmasterEventsPage = {
    events,
    totalElements: result?.page?.totalElements ?? events.length
  };

  return mapped;
}
