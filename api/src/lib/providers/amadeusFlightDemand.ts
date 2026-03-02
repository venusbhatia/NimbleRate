import { format } from "date-fns";
import { amadeusGet } from "../amadeus.js";
import { UpstreamError } from "../http.js";
import { getProviderCache, runProviderSerialized, setProviderCache } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";
import type { ExternalProvider } from "../../types.js";

const PROVIDER: ExternalProvider = "amadeus_flights";

const CITY_IATA_FALLBACKS: Record<string, string> = {
  "austin-us": "AUS",
  "new-york-us": "NYC",
  "los-angeles-us": "LAX",
  "chicago-us": "CHI",
  "miami-us": "MIA",
  "london-gb": "LON",
  "paris-fr": "PAR",
  "dubai-ae": "DXB",
  "tokyo-jp": "TYO",
  "singapore-sg": "SIN",
  "sydney-au": "SYD"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeMarketKey(cityName: string, countryCode: string) {
  return `${cityName.trim().toLowerCase().replace(/\s+/g, "-")}-${countryCode.trim().toLowerCase()}`;
}

function scoreFromMultiplier(multiplier: number) {
  return clamp(Math.round((multiplier - 0.9) / 0.24 * 100), 0, 100);
}

function mapFlightDemandMultiplier(index: number) {
  if (index >= 75) return 1.14;
  if (index >= 60) return 1.08;
  if (index >= 45) return 1.02;
  if (index >= 30) return 0.97;
  return 0.93;
}

function resolveDate(input: string) {
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) {
    return format(new Date(), "yyyy-MM-dd");
  }
  return format(date, "yyyy-MM-dd");
}

export function resolveDestinationIata(params: {
  cityName: string;
  countryCode: string;
  cityCode?: string | null;
}) {
  const fromCityCode = params.cityCode?.trim().toUpperCase();
  if (fromCityCode && /^[A-Z]{3}$/.test(fromCityCode)) {
    return fromCityCode;
  }

  const marketKey = normalizeMarketKey(params.cityName, params.countryCode);
  return CITY_IATA_FALLBACKS[marketKey] ?? null;
}

function normalizePricePressure(payload: unknown) {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = Array.isArray(root.data) ? root.data : [];
  const first = data[0] && typeof data[0] === "object" ? (data[0] as Record<string, unknown>) : {};
  const metrics = Array.isArray(first.priceMetrics) ? first.priceMetrics : [];

  const amounts: number[] = [];
  metrics.forEach((metric) => {
    if (!metric || typeof metric !== "object") return;
    const amount = toNumber((metric as Record<string, unknown>).amount);
    if (amount !== null) amounts.push(amount);
  });

  if (!amounts.length) {
    return 50;
  }

  const median = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)] ?? 250;
  return clamp(Math.round((median / 600) * 100), 0, 100);
}

function normalizeSupplyInterest(payload: unknown) {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const offers = Array.isArray(root.data) ? root.data : [];
  return clamp(offers.length * 8, 0, 100);
}

export interface FlightDemandSignal {
  destinationIata: string | null;
  pricePressureScore: number;
  supplyInterestScore: number;
  flightDemandIndex: number;
  travelIntentMultiplier: number;
  source: "amadeus" | "fallback";
}

export async function getAmadeusFlightDemandSignal(params: {
  cityName: string;
  countryCode: string;
  cityCode?: string | null;
  checkInDate: string;
}) {
  const destinationIata = resolveDestinationIata(params);
  if (!destinationIata) {
    return {
      destinationIata: null,
      pricePressureScore: 50,
      supplyInterestScore: 50,
      flightDemandIndex: 50,
      travelIntentMultiplier: 1,
      source: "fallback"
    } satisfies FlightDemandSignal;
  }

  const departureDate = resolveDate(params.checkInDate);
  const cacheKey = `amadeus:flight-demand:${destinationIata}:${departureDate}`;
  const cached = getProviderCache<FlightDemandSignal>(cacheKey);
  if (cached) {
    return cached;
  }

  return runProviderSerialized(PROVIDER, async () => {
    const secondRead = getProviderCache<FlightDemandSignal>(cacheKey);
    if (secondRead) {
      return secondRead;
    }

    let itineraryPayload: unknown = null;
    let offersPayload: unknown = null;
    let itineraryFailed = false;
    let offersFailed = false;

    try {
      assertProviderBudget(PROVIDER);
      incrementProviderUsage(PROVIDER);
      itineraryPayload = await amadeusGet<unknown>("/v1/analytics/itinerary-price-metrics", {
        originIataCode: "JFK",
        destinationIataCode: destinationIata,
        departureDate
      });
    } catch {
      itineraryFailed = true;
    }

    try {
      assertProviderBudget(PROVIDER);
      incrementProviderUsage(PROVIDER);
      offersPayload = await amadeusGet<unknown>("/v2/shopping/flight-offers", {
        originLocationCode: "JFK",
        destinationLocationCode: destinationIata,
        departureDate,
        adults: 1,
        max: 20
      });
    } catch {
      offersFailed = true;
    }

    if (itineraryFailed && offersFailed) {
      throw new UpstreamError("Amadeus flight-demand request failed", 503, {
        provider: PROVIDER,
        destinationIata
      });
    }

    const pricePressureScore = itineraryFailed ? 50 : normalizePricePressure(itineraryPayload);
    const supplyInterestScore = offersFailed ? 50 : normalizeSupplyInterest(offersPayload);
    const flightDemandIndex = clamp(
      Math.round(pricePressureScore * 0.6 + supplyInterestScore * 0.4),
      0,
      100
    );
    const travelIntentMultiplier = mapFlightDemandMultiplier(flightDemandIndex);

    const signal: FlightDemandSignal = {
      destinationIata,
      pricePressureScore,
      supplyInterestScore,
      flightDemandIndex,
      travelIntentMultiplier,
      source: "amadeus"
    };

    setProviderCache(cacheKey, signal, 30 * 60 * 1000);
    return signal;
  });
}

export function normalizeFlightDemandForFallback(multiplier = 1): FlightDemandSignal {
  return {
    destinationIata: null,
    pricePressureScore: scoreFromMultiplier(multiplier),
    supplyInterestScore: scoreFromMultiplier(multiplier),
    flightDemandIndex: scoreFromMultiplier(multiplier),
    travelIntentMultiplier: multiplier,
    source: "fallback"
  };
}
