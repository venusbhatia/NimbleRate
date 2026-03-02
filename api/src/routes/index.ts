import type { Express, Response } from "express";
import { createHash } from "node:crypto";
import { addDays, format, parseISO } from "date-fns";
import ngeohash from "ngeohash";
import { z } from "zod";
import { config } from "../config.js";
import { amadeusGet } from "../lib/amadeus.js";
import { suggestCompsetCandidates } from "../lib/compsetClustering.js";
import { executeSql, queryJson, sqlQuote } from "../lib/db.js";
import { generatePaceSimulation } from "../lib/paceSimulator.js";
import { calculateV2Recommendations, summarizeRates, type V2WeatherCategory } from "../lib/priceEngineV2.js";
import { buildUrl, fetchJsonCached, RequestValidationError, toApiError, UpstreamError } from "../lib/http.js";
import { resolvePmsPace } from "../lib/pms/adapter.js";
import { createSimulatedPmsAdapter } from "../lib/pms/simulatedAdapter.js";
import { getAmadeusFlightDemandSignal, type FlightDemandSignal } from "../lib/providers/amadeusFlightDemand.js";
import { searchMakcorpsCompset, getMakcorpsHotelRates, diagnoseMakcorpsCompset } from "../lib/providers/makcorps.js";
import { searchPredictHQEvents } from "../lib/providers/predicthq.js";
import { getSerpApiTrendsSignal, type TrendsSignal } from "../lib/providers/serpapiTrends.js";
import { getUniversityDemandSignal } from "../lib/universityDemand.js";
import { getUsageSummary } from "../lib/usageBudget.js";
import {
  validateQuery,
  zOptionalBoolean,
  zOptionalNumber,
  zOptionalString,
  zRequiredString
} from "../lib/validation.js";

const CACHE_TTL = {
  eventsMs: 60_000,
  holidaysMs: 12 * 60 * 60 * 1000,
  countriesMs: 24 * 60 * 60 * 1000,
  weatherMs: 10 * 60 * 1000,
  geocodeMs: 24 * 60 * 60 * 1000
} as const;

const hotelsByCitySchema = z.object({
  cityCode: zRequiredString,
  radius: zOptionalNumber,
  radiusUnit: zOptionalString,
  amenities: zOptionalString,
  ratings: zOptionalString,
  hotelSource: zOptionalString
});

const hotelsByGeocodeSchema = z.object({
  latitude: zRequiredString,
  longitude: zRequiredString,
  radius: zOptionalNumber,
  radiusUnit: zOptionalString,
  amenities: zOptionalString,
  ratings: zOptionalString,
  hotelSource: zOptionalString
});

const hotelsOffersSchema = z.object({
  hotelIds: zRequiredString,
  adults: zOptionalNumber,
  checkInDate: zRequiredString,
  checkOutDate: zRequiredString,
  roomQuantity: zOptionalNumber,
  currency: zOptionalString,
  priceRange: zOptionalString,
  boardType: zOptionalString,
  bestRateOnly: zOptionalBoolean
});

const hotelSentimentsSchema = z.object({
  hotelIds: zRequiredString
});

const hotelAutocompleteSchema = z.object({
  keyword: zRequiredString
});

const eventsSchema = z
  .object({
    latitude: zOptionalNumber,
    longitude: zOptionalNumber,
    geoPoint: zOptionalString,
    radius: zOptionalNumber,
    unit: zOptionalString,
    startDateTime: zOptionalString,
    endDateTime: zOptionalString,
    sort: zOptionalString,
    size: zOptionalNumber,
    page: zOptionalNumber,
    classificationName: zOptionalString
  })
  .superRefine((value, ctx) => {
    const hasLatLong = value.latitude !== undefined && value.longitude !== undefined;
    if (!hasLatLong && !value.geoPoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide latitude/longitude or geoPoint",
        path: ["geoPoint"]
      });
    }
  });

const holidaysSchema = z.object({
  year: zRequiredString,
  countryCode: zRequiredString
});

const weatherForecastSchema = z.object({
  latitude: zRequiredString,
  longitude: zRequiredString,
  units: zOptionalString
});

const weatherGeocodeSchema = z.object({
  q: zRequiredString,
  limit: zOptionalNumber
});

const compsetSearchSchema = z.object({
  city: zRequiredString,
  checkInDate: zRequiredString,
  checkOutDate: zRequiredString,
  maxResults: zOptionalNumber
});

const compsetRatesSchema = z.object({
  hotelId: zRequiredString,
  checkInDate: zRequiredString,
  checkOutDate: zRequiredString
});

const predictHqSchema = z.object({
  latitude: zRequiredString,
  longitude: zRequiredString,
  startDate: zRequiredString,
  endDate: zRequiredString,
  radiusKm: zOptionalNumber,
  rankGte: zOptionalNumber
});

const marketAnalysisSchema = z.object({
  cityName: zOptionalString,
  cityCode: zOptionalString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  latitude: zRequiredString,
  longitude: zRequiredString,
  checkInDate: zRequiredString,
  checkOutDate: zRequiredString,
  hotelType: zOptionalString,
  estimatedOccupancy: zOptionalNumber,
  adults: zOptionalNumber,
  daysForward: zOptionalNumber,
  targetMarketPosition: zOptionalNumber,
  minPrice: zOptionalNumber,
  maxPrice: zOptionalNumber,
  totalRooms: zOptionalNumber,
  useSuggestedCompset: zOptionalBoolean
});

const marketHistorySchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  days: zOptionalNumber
});

const paritySummarySchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  checkInDate: zRequiredString,
  checkOutDate: zRequiredString,
  directRate: z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.coerce.number().finite().positive()
  ),
  tolerancePct: zOptionalNumber
});

const strSupplySchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  latitude: zOptionalNumber,
  longitude: zOptionalNumber,
  daysForward: zOptionalNumber
});

const propertiesCreateSchema = z.object({
  propertyId: zRequiredString,
  name: zRequiredString,
  countryCode: zRequiredString,
  cityName: zRequiredString,
  latitude: zOptionalNumber,
  longitude: zOptionalNumber,
  hotelType: zOptionalString,
  totalRooms: zOptionalNumber,
  channelProvider: zOptionalString
});

const propertiesUpdateSchema = z.object({
  name: zOptionalString,
  countryCode: zOptionalString,
  cityName: zOptionalString,
  latitude: zOptionalNumber,
  longitude: zOptionalNumber,
  hotelType: zOptionalString,
  totalRooms: zOptionalNumber,
  channelProvider: zOptionalString
});

const compsetSuggestionsSchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  latitude: zRequiredString,
  longitude: zRequiredString,
  maxResults: zOptionalNumber
});

const portfolioSummarySchema = z.object({
  days: zOptionalNumber
});

const paceAnomaliesSchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  days: zOptionalNumber
});

const ratePushJobsListSchema = z.object({
  propertyId: zOptionalString,
  limit: zOptionalNumber
});

const revenueAnalyticsSchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  propertyId: zOptionalString,
  days: zOptionalNumber
});

const paceSimulationBodySchema = z.object({
  totalRooms: z.coerce.number().int().positive().max(2000).default(40),
  daysForward: z.coerce.number().int().min(7).max(180).default(90),
  hotelType: z.enum(["city", "business", "leisure", "beach", "ski"]).default("city"),
  seed: z.string().trim().min(1).optional(),
  startDate: z.string().trim().min(1).optional()
});

const ratePushBodySchema = z.object({
  propertyId: zOptionalString,
  marketKey: zRequiredString,
  mode: z.enum(["dry_run", "publish", "rollback"]).default("dry_run"),
  manualApproval: z.coerce.boolean().default(false),
  idempotencyKey: zOptionalString,
  requestedBy: zOptionalString,
  notes: zOptionalString,
  rollbackJobId: z.coerce.number().int().positive().optional(),
  rates: z
    .array(
      z.object({
        date: z.string().trim().min(1),
        rate: z.coerce.number().positive(),
        currency: z.string().trim().min(1).optional(),
        previousRate: z.coerce.number().positive().optional()
      })
    )
    .default([])
});

type TicketmasterEvent = {
  id: string;
  name: string;
  date: string;
  status: string;
  segment?: string;
  genre?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  popularityScore: number;
};

function handleRouteError(error: unknown, res: Response) {
  const apiError = toApiError(error, "Request failed", 500);
  res.status(apiError.status).json(apiError);
}

async function withRoute(res: Response, handler: () => Promise<unknown>) {
  try {
    const data = await handler();
    res.json(data);
  } catch (error) {
    handleRouteError(error, res);
  }
}

function normalizeArrayPayload<T>(payload: unknown): T[] {
  return Array.isArray(payload) ? (payload as T[]) : [];
}

function normalizeEventDate(rawDate: string) {
  if (rawDate.includes("T")) {
    return rawDate.slice(0, 10);
  }
  return rawDate;
}

function mapWeatherCode(code: number): V2WeatherCategory {
  if (code === 800) return "sunny";
  if (code === 801) return "partly_cloudy";
  if (code >= 802 && code <= 804) return "cloudy";
  if (code >= 200 && code <= 232) return "storm";
  if (code >= 300 && code <= 321) return "light_rain";
  if (code >= 500 && code <= 531) return "rain";
  if (code >= 600 && code <= 622) return "snow";
  return "fog";
}

function normalizeTicketmasterEvent(raw: Record<string, unknown>): TicketmasterEvent {
  const embedded = (raw._embedded as Record<string, unknown> | undefined) ?? {};
  const venues = Array.isArray(embedded.venues) ? embedded.venues : [];
  const venue = (venues[0] as Record<string, unknown> | undefined) ?? {};
  const classifications = Array.isArray(raw.classifications) ? raw.classifications : [];
  const classification = (classifications[0] as Record<string, unknown> | undefined) ?? {};
  const segment = (classification.segment as Record<string, unknown> | undefined) ?? {};
  const genre = (classification.genre as Record<string, unknown> | undefined) ?? {};
  const priceRanges = Array.isArray(raw.priceRanges) ? raw.priceRanges : [];
  const priceRange = (priceRanges[0] as Record<string, unknown> | undefined) ?? {};
  const attractions = Array.isArray(embedded.attractions) ? embedded.attractions : [];
  const attraction = (attractions[0] as Record<string, unknown> | undefined) ?? {};
  const upcomingEvents = (attraction.upcomingEvents as Record<string, unknown> | undefined) ?? {};
  const dates = (raw.dates as Record<string, unknown> | undefined) ?? {};
  const start = (dates.start as Record<string, unknown> | undefined) ?? {};
  const status = (dates.status as Record<string, unknown> | undefined) ?? {};
  const venueLocation = (venue.location as Record<string, unknown> | undefined) ?? {};

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Unknown event"),
    date: String(start.localDate ?? start.dateTime ?? ""),
    status: String(status.code ?? "unknown"),
    segment: typeof segment.name === "string" ? segment.name : undefined,
    genre: typeof genre.name === "string" ? genre.name : undefined,
    minPrice: typeof priceRange.min === "number" ? priceRange.min : undefined,
    maxPrice: typeof priceRange.max === "number" ? priceRange.max : undefined,
    currency: typeof priceRange.currency === "string" ? priceRange.currency : undefined,
    venueName: typeof venue.name === "string" ? venue.name : undefined,
    venueLatitude: typeof venueLocation.latitude === "string" ? Number(venueLocation.latitude) : undefined,
    venueLongitude: typeof venueLocation.longitude === "string" ? Number(venueLocation.longitude) : undefined,
    popularityScore: Number(upcomingEvents._total ?? 0) + (Number(priceRange.max) || 0) / 25
  };
}

async function fetchTicketmasterEvents(params: z.infer<typeof eventsSchema>) {
  const hasLatLong = params.latitude !== undefined && params.longitude !== undefined;
  const resolvedGeoPoint = params.geoPoint ?? ngeohash.encode(params.latitude!, params.longitude!, 7);

  const url = buildUrl("https://app.ticketmaster.com/discovery/v2", "/events.json", {
    apikey: config.ticketmasterApiKey,
    geoPoint: resolvedGeoPoint,
    latlong: hasLatLong ? `${params.latitude},${params.longitude}` : undefined,
    radius: params.radius ?? 25,
    unit: params.unit ?? "miles",
    startDateTime: params.startDateTime,
    endDateTime: params.endDateTime,
    sort: params.sort ?? "date,asc",
    size: params.size ?? 50,
    page: params.page ?? 0,
    classificationName: params.classificationName
  });

  return fetchJsonCached<{
    _embedded?: {
      events?: Array<Record<string, unknown>>;
    };
    page?: {
      totalElements?: number;
    };
  }>(url, {}, "Ticketmaster API request failed", CACHE_TTL.eventsMs);
}

function toWeatherSummary(payload: unknown) {
  const list =
    payload && typeof payload === "object" && Array.isArray((payload as { list?: unknown[] }).list)
      ? (payload as { list: unknown[] }).list
      : [];

  const grouped = new Map<string, Array<Record<string, unknown>>>();

  list.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const point = entry as Record<string, unknown>;
    const date = typeof point.dt_txt === "string" ? point.dt_txt.slice(0, 10) : "";
    if (!date) return;
    const bucket = grouped.get(date) ?? [];
    bucket.push(point);
    grouped.set(date, bucket);
  });

  return Array.from(grouped.entries())
    .slice(0, 5)
    .map(([date, points]) => {
      const avgTemp =
        points.reduce((sum, point) => {
          const main = (point.main as Record<string, unknown> | undefined) ?? {};
          return sum + Number(main.temp ?? 0);
        }, 0) / points.length;

      const highestPopPoint = points.reduce((best, current) => {
        const currentPop = Number(current.pop ?? 0);
        const bestPop = Number(best.pop ?? 0);
        return currentPop > bestPop ? current : best;
      }, points[0]);

      const weatherArray = Array.isArray(highestPopPoint.weather) ? highestPopPoint.weather : [];
      const weather = (weatherArray[0] as Record<string, unknown> | undefined) ?? {};

      return {
        date,
        label: date,
        avgTemp,
        maxPop: Number(highestPopPoint.pop ?? 0),
        category: mapWeatherCode(Number(weather.id ?? 801)),
        icon: typeof weather.icon === "string" ? weather.icon : "02d"
      };
    });
}

function sanitizePropertyId(raw: string | null | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed) return "default";
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64) || "default";
}

type PropertyRecord = {
  propertyId: string;
  name: string;
  countryCode: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  hotelType: "city" | "business" | "leisure" | "beach" | "ski";
  totalRooms: number;
  channelProvider: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeHotelType(raw: string | null | undefined): PropertyRecord["hotelType"] {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "business") return "business";
  if (normalized === "leisure") return "leisure";
  if (normalized === "beach") return "beach";
  if (normalized === "ski") return "ski";
  return "city";
}

function mapPropertyRow(row: {
  property_id: string;
  name: string;
  country_code: string;
  city_name: string;
  lat: number | null;
  lon: number | null;
  hotel_type: string;
  total_rooms: number;
  channel_provider: string;
  created_at: string;
  updated_at: string;
}): PropertyRecord {
  return {
    propertyId: row.property_id,
    name: row.name,
    countryCode: row.country_code,
    cityName: row.city_name,
    latitude: row.lat === null ? null : Number(row.lat),
    longitude: row.lon === null ? null : Number(row.lon),
    hotelType: normalizeHotelType(row.hotel_type),
    totalRooms: Math.max(1, Number(row.total_rooms || 40)),
    channelProvider: (row.channel_provider || "simulated").toLowerCase(),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getPropertyById(propertyId: string) {
  const row = queryJson<{
    property_id: string;
    name: string;
    country_code: string;
    city_name: string;
    lat: number | null;
    lon: number | null;
    hotel_type: string;
    total_rooms: number;
    channel_provider: string;
    created_at: string;
    updated_at: string;
  }>(`
    SELECT property_id, name, country_code, city_name, lat, lon, hotel_type, total_rooms, channel_provider, created_at, updated_at
    FROM properties
    WHERE property_id = ${sqlQuote(propertyId)}
    LIMIT 1;
  `)[0];

  return row ? mapPropertyRow(row) : null;
}

function requirePropertyById(propertyId: string) {
  const property = getPropertyById(propertyId);
  if (!property) {
    throw new UpstreamError("Property not found", 404, {
      code: "PROPERTY_NOT_FOUND",
      propertyId,
      hint: "Create the property via POST /api/properties."
    });
  }
  return property;
}

function fallbackSupplyFromSnapshots(input: {
  propertyId: string;
  cityName: string;
  countryCode: string;
  daysForward: number;
}) {
  const marketKey = normalizeMarketKey(input.cityName, input.countryCode);
  const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const cityLower = input.cityName.trim().toLowerCase();

  const rows = queryJson<{ day: string; sample_size: number; avg_rate: number }>(`
    SELECT substr(collected_at, 1, 10) AS day,
           COUNT(*) AS sample_size,
           AVG(rate) AS avg_rate
    FROM compset_snapshots
    WHERE property_id = ${sqlQuote(input.propertyId)}
      AND lower(city) = ${sqlQuote(cityLower)}
      AND collected_at >= ${sqlQuote(cutoffIso)}
    GROUP BY substr(collected_at, 1, 10)
    ORDER BY day ASC;
  `);

  if (!rows.length) {
    return {
      propertyId: input.propertyId,
      marketKey,
      source: "fallback_proxy" as const,
      status: "neutral_fallback" as const,
      supplyPressureIndex: 50,
      recommendedMultiplier: 1,
      activeListingsEstimate: 0,
      trend: "unknown" as const,
      daysForward: input.daysForward
    };
  }

  const sampleAvg = average(rows.map((row) => Number(row.sample_size) || 0));
  const firstRate = Number(rows[0].avg_rate || 0);
  const lastRate = Number(rows[rows.length - 1].avg_rate || 0);
  const trendPct = firstRate > 0 ? ((lastRate - firstRate) / firstRate) * 100 : 0;
  const supplyPressureIndex = Math.min(100, Math.max(0, Math.round(50 + (sampleAvg - 20) * 1.2 + trendPct * 0.8)));
  const recommendedMultiplier =
    supplyPressureIndex >= 75
      ? 0.94
      : supplyPressureIndex >= 60
        ? 0.97
        : supplyPressureIndex >= 45
          ? 1
          : supplyPressureIndex >= 30
            ? 1.03
            : 1.06;

  return {
    propertyId: input.propertyId,
    marketKey,
    source: "fallback_proxy" as const,
    status: "ok" as const,
    supplyPressureIndex,
    recommendedMultiplier: Number(recommendedMultiplier.toFixed(2)),
    activeListingsEstimate: Math.max(1, Math.round(sampleAvg * 0.6)),
    trend: trendPct >= 4 ? ("rising" as const) : trendPct <= -4 ? ("falling" as const) : ("stable" as const),
    trendPct: Number(trendPct.toFixed(2)),
    daysForward: input.daysForward
  };
}

function buildIdempotencyKey(payload: {
  propertyId: string;
  marketKey: string;
  mode: string;
  rollbackJobId?: number | null;
  rates: Array<{ date: string; rate: number; currency?: string }>;
}) {
  const canonical = JSON.stringify({
    propertyId: payload.propertyId,
    marketKey: payload.marketKey,
    mode: payload.mode,
    rollbackJobId: payload.rollbackJobId ?? null,
    rates: payload.rates
      .map((rate) => ({
        date: rate.date,
        rate: Number(rate.rate),
        currency: (rate.currency ?? "USD").toUpperCase()
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function saveCompsetSnapshot(
  propertyId: string,
  city: string,
  checkInDate: string,
  checkOutDate: string,
  rows: Array<{
    hotelId: string;
    hotelName: string;
    rate: number;
    ota: string;
  }>
) {
  const collectedAt = new Date().toISOString();
  rows.forEach((row) => {
    executeSql(`
      INSERT INTO compset_snapshots(property_id, city, check_in, check_out, hotel_name, hotel_id, rate, ota, collected_at)
      VALUES (
        ${sqlQuote(propertyId)},
        ${sqlQuote(city)},
        ${sqlQuote(checkInDate)},
        ${sqlQuote(checkOutDate)},
        ${sqlQuote(row.hotelName)},
        ${sqlQuote(row.hotelId)},
        ${Number(row.rate)},
        ${sqlQuote(row.ota)},
        ${sqlQuote(collectedAt)}
      );
    `);
  });
}

function saveAnalysisRun(
  propertyId: string,
  marketKey: string,
  confidence: string,
  anchorRate: number,
  recommendedRate: number,
  payload: unknown
) {
  const requestedAt = new Date().toISOString();
  executeSql(`
    INSERT INTO analysis_runs(property_id, market_key, requested_at, confidence, anchor_rate, recommended_rate, payload_json)
    VALUES (
      ${sqlQuote(propertyId)},
      ${sqlQuote(marketKey)},
      ${sqlQuote(requestedAt)},
      ${sqlQuote(confidence)},
      ${Number(anchorRate)},
      ${Number(recommendedRate)},
      ${sqlQuote(JSON.stringify(payload))}
    );
  `);

  const insertedId = queryJson<{ id: number }>(`
    SELECT id
    FROM analysis_runs
    WHERE property_id = ${sqlQuote(propertyId)}
      AND market_key = ${sqlQuote(marketKey)}
      AND requested_at = ${sqlQuote(requestedAt)}
    ORDER BY id DESC
    LIMIT 1;
  `)[0]?.id;
  return {
    id: Number(insertedId ?? 0),
    requestedAt
  };
}

function saveAnalysisDailyRows(
  analysisRunId: number,
  propertyId: string,
  marketKey: string,
  createdAt: string,
  rows: Array<{
    date: string;
    recommendedRate: number;
    anchorRate: number;
    occupancyRate: number;
    finalMultiplier: number;
    rawMultiplier: number;
    eventImpact: number;
    weatherCategory: string;
  }>
) {
  if (!Number.isFinite(analysisRunId) || analysisRunId <= 0) {
    return;
  }

  rows.forEach((row) => {
    executeSql(`
      INSERT INTO analysis_daily(
        analysis_run_id, property_id, market_key, analysis_date, recommended_rate, anchor_rate, occupancy_rate,
        final_multiplier, raw_multiplier, event_impact, weather_category, created_at
      )
      VALUES (
        ${analysisRunId},
        ${sqlQuote(propertyId)},
        ${sqlQuote(marketKey)},
        ${sqlQuote(row.date)},
        ${Number(row.recommendedRate)},
        ${Number(row.anchorRate)},
        ${Number(row.occupancyRate)},
        ${Number(row.finalMultiplier)},
        ${Number(row.rawMultiplier)},
        ${Number(row.eventImpact)},
        ${sqlQuote(row.weatherCategory)},
        ${sqlQuote(createdAt)}
      );
    `);
  });
}

function normalizeMarketKey(cityName: string, countryCode: string) {
  const normalizedCity = cityName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const normalizedCountry = countryCode.trim().toLowerCase();
  return `${normalizedCity}-${normalizedCountry}`;
}

function normalizeStoredMarketKey(rawMarketKey: string) {
  const trimmed = rawMarketKey.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  const parts = lower.split("-").filter(Boolean);
  if (parts.length < 2) {
    return lower.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  const country = parts[parts.length - 1];
  const city = parts.slice(0, -1).join("-");
  return normalizeMarketKey(city, country);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function stdDev(values: number[]) {
  if (!values.length) return 0;
  const avg = average(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

type SourceHealthStatus = "ok" | "loading" | "error";
type SourceHealthDiagnostics = {
  degraded: boolean;
  errors: string[];
  hasData: boolean;
};

function resolveSourceStatus(diagnostics: SourceHealthDiagnostics): SourceHealthStatus {
  if (diagnostics.errors.length > 0 && !diagnostics.hasData) {
    return "error";
  }
  if (diagnostics.degraded || diagnostics.errors.length > 0) {
    return "loading";
  }
  return "ok";
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "nimblerate-api" });
  });

  app.get("/api/hotels/by-city", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, hotelsByCitySchema);
      return amadeusGet("/v1/reference-data/locations/hotels/by-city", params);
    });
  });

  app.get("/api/hotels/by-geocode", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, hotelsByGeocodeSchema);
      return amadeusGet("/v1/reference-data/locations/hotels/by-geocode", params);
    });
  });

  app.get("/api/hotels/offers", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, hotelsOffersSchema);
      return amadeusGet("/v3/shopping/hotel-offers", {
        ...params,
        adults: params.adults ?? 2
      });
    });
  });

  app.get("/api/hotels/offers/:offerId", async (req, res) => {
    await withRoute(res, async () => amadeusGet(`/v3/shopping/hotel-offers/${req.params.offerId}`, {}));
  });

  app.get("/api/hotels/sentiments", async (req, res) => {
    await withRoute(res, async () => {
      const { hotelIds } = validateQuery(req, hotelSentimentsSchema);
      return amadeusGet("/v2/e-reputation/hotel-sentiments", { hotelIds });
    });
  });

  app.get("/api/hotels/autocomplete", async (req, res) => {
    await withRoute(res, async () => {
      const { keyword } = validateQuery(req, hotelAutocompleteSchema);
      return amadeusGet("/v1/reference-data/locations/hotel", {
        keyword,
        subType: "HOTEL_LEISURE"
      });
    });
  });

  app.get("/api/events", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, eventsSchema);
      return fetchTicketmasterEvents(params);
    });
  });

  app.get("/api/holidays/public", async (req, res) => {
    await withRoute(res, async () => {
      const { year, countryCode } = validateQuery(req, holidaysSchema);
      const url = `${config.nagerBaseUrl}/PublicHolidays/${year}/${countryCode}`;
      const payload = await fetchJsonCached<unknown>(url, {}, "Nager public holidays request failed", CACHE_TTL.holidaysMs);
      return normalizeArrayPayload(payload);
    });
  });

  app.get("/api/holidays/long-weekends", async (req, res) => {
    await withRoute(res, async () => {
      const { year, countryCode } = validateQuery(req, holidaysSchema);
      const url = `${config.nagerBaseUrl}/LongWeekend/${year}/${countryCode}`;
      const payload = await fetchJsonCached<unknown>(url, {}, "Nager long weekend request failed", CACHE_TTL.holidaysMs);
      return normalizeArrayPayload(payload);
    });
  });

  app.get("/api/holidays/countries", async (_req, res) => {
    await withRoute(res, async () => {
      const url = `${config.nagerBaseUrl}/AvailableCountries`;
      return fetchJsonCached(url, {}, "Nager available countries request failed", CACHE_TTL.countriesMs);
    });
  });

  app.get("/api/weather/forecast", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, weatherForecastSchema);
      const url = buildUrl("https://api.openweathermap.org/data/2.5", "/forecast", {
        lat: params.latitude,
        lon: params.longitude,
        appid: config.openWeatherApiKey,
        units: params.units ?? "metric"
      });

      return fetchJsonCached(url, {}, "OpenWeather forecast request failed", CACHE_TTL.weatherMs);
    });
  });

  app.get("/api/weather/geocode", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, weatherGeocodeSchema);
      const url = buildUrl("https://api.openweathermap.org/geo/1.0", "/direct", {
        q: params.q,
        limit: params.limit ?? 5,
        appid: config.openWeatherApiKey
      });

      return fetchJsonCached(url, {}, "OpenWeather geocode request failed", CACHE_TTL.geocodeMs);
    });
  });

  app.get("/api/compset/search", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, compsetSearchSchema);
      const hotels = await searchMakcorpsCompset({
        city: params.city,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        maxResults: params.maxResults
      });
      return {
        city: params.city,
        hotels
      };
    });
  });

  app.get("/api/providers/makcorps/diagnostics", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, compsetSearchSchema);
      return diagnoseMakcorpsCompset({
        city: params.city,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate
      });
    });
  });

  app.get("/api/compset/rates", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, compsetRatesSchema);
      const hotel = await getMakcorpsHotelRates(params);
      return {
        hotel
      };
    });
  });

  app.get("/api/compset/suggestions", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, compsetSuggestionsSchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const property = requirePropertyById(propertyId);
      const maxResults = Math.min(20, Math.max(3, Math.round(params.maxResults ?? 8)));
      const marketKey = normalizeMarketKey(params.cityName, params.countryCode);
      const cityLower = params.cityName.trim().toLowerCase();

      const candidates = queryJson<{
        hotel_id: string;
        hotel_name: string;
        avg_rate: number;
        sample_size: number;
      }>(`
        SELECT hotel_id, hotel_name, AVG(rate) AS avg_rate, COUNT(*) AS sample_size
        FROM compset_snapshots
        WHERE property_id = ${sqlQuote(propertyId)}
          AND lower(city) = ${sqlQuote(cityLower)}
        GROUP BY hotel_id, hotel_name
        HAVING sample_size > 0
        ORDER BY sample_size DESC, avg_rate ASC
        LIMIT 120;
      `).map((row) => ({
        hotelId: row.hotel_id,
        hotelName: row.hotel_name,
        averageRate: Number(row.avg_rate || 0),
        sampleSize: Number(row.sample_size || 0)
      }));

      if (!candidates.length) {
        throw new UpstreamError("No compset snapshots available for suggestions", 409, {
          code: "ANALYSIS_REQUIRED",
          propertyId,
          marketKey,
          hint: "Run analysis first to generate compset history."
        });
      }

      const latestAnalysis = queryJson<{ payload_json: string }>(`
        SELECT payload_json
        FROM analysis_runs
        WHERE property_id = ${sqlQuote(propertyId)}
          AND market_key = ${sqlQuote(marketKey)}
        ORDER BY requested_at DESC
        LIMIT 1;
      `)[0];

      let demandIndex = 50;
      const anchorRate = average(candidates.map((candidate) => candidate.averageRate));
      if (latestAnalysis?.payload_json) {
        try {
          const parsed = JSON.parse(latestAnalysis.payload_json) as Record<string, unknown>;
          const kpis = parsed.kpis as Record<string, unknown> | undefined;
          demandIndex = Number(kpis?.demandPressureIndex ?? demandIndex);
        } catch {
          // no-op
        }
      }

      const suggestions = suggestCompsetCandidates({
        latitude: Number(params.latitude),
        longitude: Number(params.longitude),
        anchorRate,
        demandIndex,
        maxResults,
        candidates
      });

      return {
        version: "v1",
        propertyId,
        propertyName: property.name,
        marketKey,
        generatedAt: new Date().toISOString(),
        suggestions
      };
    });
  });

  app.get("/api/events/predicthq", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, predictHqSchema);
      const events = await searchPredictHQEvents({
        latitude: Number(params.latitude),
        longitude: Number(params.longitude),
        startDate: params.startDate,
        endDate: params.endDate,
        radiusKm: params.radiusKm,
        rankGte: params.rankGte
      });
      return { events };
    });
  });

  app.post("/api/pace/simulate", async (req, res) => {
    await withRoute(res, async () => {
      const parsed = paceSimulationBodySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new RequestValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      }

      const pace = generatePaceSimulation({
        totalRooms: parsed.data.totalRooms,
        daysForward: parsed.data.daysForward,
        hotelType: parsed.data.hotelType,
        seed: parsed.data.seed ?? `${config.demoCity}-${parsed.data.totalRooms}`,
        startDate: parsed.data.startDate
      });

      return {
        totalRooms: parsed.data.totalRooms,
        daysForward: parsed.data.daysForward,
        pace
      };
    });
  });

  app.get("/api/usage/summary", async (_req, res) => {
    await withRoute(res, async () => getUsageSummary());
  });

  app.get("/api/properties", async (_req, res) => {
    await withRoute(res, async () => {
      const rows = queryJson<{
        property_id: string;
        name: string;
        country_code: string;
        city_name: string;
        lat: number | null;
        lon: number | null;
        hotel_type: string;
        total_rooms: number;
        channel_provider: string;
        created_at: string;
        updated_at: string;
      }>(`
        SELECT property_id, name, country_code, city_name, lat, lon, hotel_type, total_rooms, channel_provider, created_at, updated_at
        FROM properties
        ORDER BY updated_at DESC, property_id ASC;
      `);

      return {
        generatedAt: new Date().toISOString(),
        properties: rows.map(mapPropertyRow)
      };
    });
  });

  app.post("/api/properties", async (req, res) => {
    await withRoute(res, async () => {
      const parsed = propertiesCreateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new RequestValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      }

      const body = parsed.data;
      const propertyId = sanitizePropertyId(body.propertyId);
      const existing = getPropertyById(propertyId);
      if (existing) {
        throw new UpstreamError("Property already exists", 409, {
          code: "PROPERTY_EXISTS",
          propertyId
        });
      }

      const name = body.name.trim();
      const countryCode = body.countryCode.trim().toUpperCase();
      const cityName = body.cityName.trim();
      const latitude = body.latitude !== undefined ? Number(body.latitude) : null;
      const longitude = body.longitude !== undefined ? Number(body.longitude) : null;
      const hotelType = normalizeHotelType(body.hotelType);
      const totalRooms = Math.max(1, Math.round(Number(body.totalRooms ?? 40)));
      const channelProvider = body.channelProvider?.trim().toLowerCase() || "simulated";
      const nowIso = new Date().toISOString();

      executeSql(`
        INSERT INTO properties(
          property_id, name, country_code, city_name, lat, lon, hotel_type, total_rooms, channel_provider, created_at, updated_at
        )
        VALUES (
          ${sqlQuote(propertyId)},
          ${sqlQuote(name)},
          ${sqlQuote(countryCode)},
          ${sqlQuote(cityName)},
          ${latitude === null ? "NULL" : Number(latitude)},
          ${longitude === null ? "NULL" : Number(longitude)},
          ${sqlQuote(hotelType)},
          ${totalRooms},
          ${sqlQuote(channelProvider)},
          ${sqlQuote(nowIso)},
          ${sqlQuote(nowIso)}
        );
      `);

      return {
        created: true,
        property: requirePropertyById(propertyId)
      };
    });
  });

  app.patch("/api/properties/:propertyId", async (req, res) => {
    await withRoute(res, async () => {
      const parsed = propertiesUpdateSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new RequestValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      }

      const propertyId = sanitizePropertyId(req.params.propertyId);
      const current = requirePropertyById(propertyId);
      const updates = parsed.data;

      const name = updates.name?.trim() || current.name;
      const countryCode = updates.countryCode?.trim().toUpperCase() || current.countryCode;
      const cityName = updates.cityName?.trim() || current.cityName;
      const latitude = updates.latitude !== undefined ? Number(updates.latitude) : current.latitude;
      const longitude = updates.longitude !== undefined ? Number(updates.longitude) : current.longitude;
      const hotelType = updates.hotelType ? normalizeHotelType(updates.hotelType) : current.hotelType;
      const totalRooms =
        updates.totalRooms !== undefined ? Math.max(1, Math.round(Number(updates.totalRooms))) : current.totalRooms;
      const channelProvider = updates.channelProvider?.trim().toLowerCase() || current.channelProvider;
      const nowIso = new Date().toISOString();

      executeSql(`
        UPDATE properties
        SET
          name = ${sqlQuote(name)},
          country_code = ${sqlQuote(countryCode)},
          city_name = ${sqlQuote(cityName)},
          lat = ${latitude === null ? "NULL" : Number(latitude)},
          lon = ${longitude === null ? "NULL" : Number(longitude)},
          hotel_type = ${sqlQuote(hotelType)},
          total_rooms = ${Number(totalRooms)},
          channel_provider = ${sqlQuote(channelProvider)},
          updated_at = ${sqlQuote(nowIso)}
        WHERE property_id = ${sqlQuote(propertyId)};
      `);

      return {
        updated: true,
        property: requirePropertyById(propertyId)
      };
    });
  });

  app.get("/api/pms/health", async (_req, res) => {
    await withRoute(res, async () => {
      const simulated = createSimulatedPmsAdapter();
      const simulatedHealth = await simulated.health();
      const cloudbedsDeferredHealth = {
        provider: "cloudbeds" as const,
        configured: false,
        message: "Cloudbeds live mode is disabled in this deployment; simulated PMS remains active."
      };

      return {
        selectedProvider: "simulated",
        activeMode: "simulated",
        fallbackEnabled: true,
        generatedAt: new Date().toISOString(),
        providers: [simulatedHealth, cloudbedsDeferredHealth]
      };
    });
  });

  app.post("/api/rates/push", async (req, res) => {
    await withRoute(res, async () => {
      const parsed = ratePushBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new RequestValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
      }

      const payload = parsed.data;
      const propertyId = sanitizePropertyId(payload.propertyId);
      const property = requirePropertyById(propertyId);
      const marketKey = payload.marketKey.trim().toLowerCase();
      const requestedBy = payload.requestedBy?.trim() || "operator";
      const mode = payload.mode;

      if (mode === "publish" || mode === "rollback") {
        throw new UpstreamError(
          "Live publish is disabled in this deployment. Use mode=dry_run to simulate rate pushes.",
          409,
          {
            code: "PUBLISH_PROVIDER_DISABLED",
            mode,
            propertyId,
            marketKey
          }
        );
      }

      const rates = payload.rates;
      if (!rates.length) {
        throw new RequestValidationError("At least one rate row is required.");
      }

      const normalizedRates = rates.map((rate) => ({
        date: rate.date,
        rate: Number(rate.rate),
        currency: rate.currency?.trim().toUpperCase() || "USD",
        previousRate: rate.previousRate
      }));

      const idempotencyKey =
        payload.idempotencyKey?.trim() ||
        buildIdempotencyKey({
          propertyId,
          marketKey,
          mode,
          rollbackJobId: payload.rollbackJobId ?? null,
          rates: normalizedRates
        });

      const duplicateJob = queryJson<{
        id: number;
        status: string;
        mode: string;
      }>(`
        SELECT id, status, mode
        FROM rate_push_jobs
        WHERE property_id = ${sqlQuote(propertyId)}
          AND idempotency_key = ${sqlQuote(idempotencyKey)}
          AND mode = ${sqlQuote(mode)}
        ORDER BY id DESC
        LIMIT 1;
      `)[0];

      if (duplicateJob) {
        return {
          jobId: duplicateJob.id,
          propertyId,
          marketKey,
          mode: duplicateJob.mode,
          status: duplicateJob.status,
          manualApproval: payload.manualApproval,
          simulated: mode === "dry_run",
          idempotencyKey,
          ratesCount: normalizedRates.length,
          rollbackJobId: payload.rollbackJobId ?? null,
          duplicate: true,
          message: "Duplicate idempotent request detected. Returning existing job."
        };
      }

      const nowIso = new Date().toISOString();
      const initialStatus = mode === "dry_run" ? "completed" : "queued";
      const approvedAt = mode === "dry_run" ? null : nowIso;
      const completedAt = mode === "dry_run" ? nowIso : null;
      const notes = payload.notes?.trim() ?? "";

      executeSql(`
        INSERT INTO rate_push_jobs(
          property_id, market_key, mode, status, idempotency_key, requested_by, requested_at,
          approved_at, completed_at, rollback_job_id, notes, payload_json
        )
        VALUES (
          ${sqlQuote(propertyId)},
          ${sqlQuote(marketKey)},
          ${sqlQuote(mode)},
          ${sqlQuote(initialStatus)},
          ${sqlQuote(idempotencyKey)},
          ${sqlQuote(requestedBy)},
          ${sqlQuote(nowIso)},
          ${approvedAt ? sqlQuote(approvedAt) : "NULL"},
          ${completedAt ? sqlQuote(completedAt) : "NULL"},
          ${payload.rollbackJobId ? Number(payload.rollbackJobId) : "NULL"},
          ${sqlQuote(notes || "")},
          ${sqlQuote(
            JSON.stringify({
              manualApproval: payload.manualApproval,
              ratesCount: normalizedRates.length,
              channelProvider: property.channelProvider
            })
          )}
        );
      `);

      const jobId = Number(
        queryJson<{ id: number }>(`
          SELECT id
          FROM rate_push_jobs
          WHERE property_id = ${sqlQuote(propertyId)}
            AND market_key = ${sqlQuote(marketKey)}
            AND requested_at = ${sqlQuote(nowIso)}
            AND mode = ${sqlQuote(mode)}
          ORDER BY id DESC
          LIMIT 1;
      `)[0]?.id ?? 0
      );

      if (!Number.isFinite(jobId) || jobId <= 0) {
        throw new UpstreamError("Failed to create rate push job", 500, { code: "JOB_CREATE_FAILED" });
      }

      const itemStatus = mode === "dry_run" ? "dry_run" : "queued";
      normalizedRates.forEach((rate) => {
        executeSql(`
          INSERT INTO rate_push_job_items(
            job_id, rate_date, target_rate, previous_rate, currency, status, message, external_reference, attempt_count, created_at
          )
          VALUES (
            ${jobId},
            ${sqlQuote(rate.date)},
            ${Number(rate.rate)},
            ${rate.previousRate ? Number(rate.previousRate) : "NULL"},
            ${sqlQuote(rate.currency)},
            ${sqlQuote(itemStatus)},
            ${sqlQuote(mode === "dry_run" ? "Dry-run only; no external push executed." : "Queued for publish.")},
            NULL,
            1,
            ${sqlQuote(nowIso)}
          );
        `);
      });

      return {
        jobId,
        propertyId,
        marketKey,
        mode,
        status: initialStatus,
        manualApproval: payload.manualApproval,
        simulated: true,
        idempotencyKey,
        ratesCount: normalizedRates.length,
        rollbackJobId: payload.rollbackJobId ?? null,
        message:
          "Dry-run complete. No channel-manager push was executed."
      };
    });
  });

  app.get("/api/rates/push/jobs", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, ratePushJobsListSchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const limit = Math.min(100, Math.max(1, Math.round(params.limit ?? 20)));
      requirePropertyById(propertyId);

      const rows = queryJson<{
        id: number;
        property_id: string;
        market_key: string;
        mode: string;
        status: string;
        idempotency_key: string | null;
        requested_by: string;
        requested_at: string;
        approved_at: string | null;
        completed_at: string | null;
        rollback_job_id: number | null;
      }>(`
        SELECT id, property_id, market_key, mode, status, idempotency_key, requested_by, requested_at, approved_at, completed_at, rollback_job_id
        FROM rate_push_jobs
        WHERE property_id = ${sqlQuote(propertyId)}
        ORDER BY requested_at DESC
        LIMIT ${limit};
      `);

      return {
        propertyId,
        jobs: rows.map((job) => ({
          id: job.id,
          propertyId: job.property_id,
          marketKey: job.market_key,
          mode: job.mode,
          status: job.status,
          idempotencyKey: job.idempotency_key,
          requestedBy: job.requested_by,
          requestedAt: job.requested_at,
          approvedAt: job.approved_at,
          completedAt: job.completed_at,
          rollbackJobId: job.rollback_job_id
        }))
      };
    });
  });

  app.get("/api/rates/push/jobs/:jobId", async (req, res) => {
    await withRoute(res, async () => {
      const jobId = Number(req.params.jobId);
      if (!Number.isFinite(jobId) || jobId <= 0) {
        throw new RequestValidationError("jobId must be a positive integer.");
      }

      const job = queryJson<{
        id: number;
        property_id: string;
        market_key: string;
        mode: string;
        status: string;
        idempotency_key: string | null;
        requested_by: string;
        requested_at: string;
        approved_at: string | null;
        completed_at: string | null;
        rollback_job_id: number | null;
        notes: string | null;
        payload_json: string;
      }>(`
        SELECT id, property_id, market_key, mode, status, idempotency_key, requested_by, requested_at, approved_at,
               completed_at, rollback_job_id, notes, payload_json
        FROM rate_push_jobs
        WHERE id = ${jobId}
        LIMIT 1;
      `)[0];

      if (!job) {
        throw new UpstreamError("Rate push job not found", 404, { code: "JOB_NOT_FOUND", jobId });
      }

      const items = queryJson<{
        id: number;
        rate_date: string;
        target_rate: number;
        previous_rate: number | null;
        currency: string;
        status: string;
        external_reference: string | null;
        attempt_count: number;
        message: string | null;
        created_at: string;
      }>(`
        SELECT id, rate_date, target_rate, previous_rate, currency, status, external_reference, attempt_count, message, created_at
        FROM rate_push_job_items
        WHERE job_id = ${jobId}
        ORDER BY rate_date ASC;
      `);

      let parsedPayload: unknown = null;
      try {
        parsedPayload = JSON.parse(job.payload_json);
      } catch {
        parsedPayload = null;
      }

      return {
        job: {
          id: job.id,
          propertyId: job.property_id,
          marketKey: job.market_key,
          mode: job.mode,
          status: job.status,
          idempotencyKey: job.idempotency_key,
          requestedBy: job.requested_by,
          requestedAt: job.requested_at,
          approvedAt: job.approved_at,
          completedAt: job.completed_at,
          rollbackJobId: job.rollback_job_id,
          notes: job.notes,
          payload: parsedPayload
        },
        items: items.map((item) => ({
          id: item.id,
          date: item.rate_date,
          rate: Number(item.target_rate),
          previousRate: item.previous_rate === null ? null : Number(item.previous_rate),
          currency: item.currency,
          status: item.status,
          externalReference: item.external_reference,
          attemptCount: Math.max(1, Number(item.attempt_count || 1)),
          message: item.message,
          createdAt: item.created_at
        }))
      };
    });
  });

  app.get("/api/supply/str", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, strSupplySchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const property = requirePropertyById(propertyId);
      const daysForward = Math.min(90, Math.max(7, Math.round(params.daysForward ?? 30)));
      const cityName = params.cityName.trim() || property.cityName;
      const countryCode = params.countryCode.trim().toUpperCase() || property.countryCode;

      const fallback = fallbackSupplyFromSnapshots({
        propertyId,
        cityName,
        countryCode,
        daysForward
      });

      return {
        ...fallback,
        warning: "AirDNA is deferred in this deployment; using fallback proxy supply model."
      };
    });
  });

  app.get("/api/portfolio/summary", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, portfolioSummarySchema);
      const days = Math.min(180, Math.max(7, Math.round(params.days ?? 30)));
      const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const rows = queryJson<{
        property_id: string;
        points: number;
        run_count: number;
        adr_avg: number;
        occupancy_avg: number;
        revpar_avg: number;
        last_at: string;
      }>(`
        SELECT property_id,
               COUNT(*) AS points,
               COUNT(DISTINCT analysis_run_id) AS run_count,
               AVG(recommended_rate) AS adr_avg,
               AVG(occupancy_rate) AS occupancy_avg,
               AVG(recommended_rate * (occupancy_rate / 100.0)) AS revpar_avg,
               MAX(created_at) AS last_at
        FROM analysis_daily
        WHERE created_at >= ${sqlQuote(cutoffIso)}
        GROUP BY property_id
        ORDER BY last_at DESC;
      `);

      const properties = rows.map((row) => ({
        propertyId: row.property_id,
        analysisPoints: Number(row.points || 0),
        analysisRuns: Number(row.run_count || 0),
        adrAvg: Number(Number(row.adr_avg || 0).toFixed(2)),
        occupancyAvg: Number(Number(row.occupancy_avg || 0).toFixed(2)),
        revparAvg: Number(Number(row.revpar_avg || 0).toFixed(2)),
        lastRunAt: row.last_at
      }));

      return {
        windowDays: days,
        propertyCount: properties.length,
        totals: {
          analysisRuns: properties.reduce((sum, row) => sum + row.analysisRuns, 0),
          adrAvg: Number(average(properties.map((row) => row.adrAvg)).toFixed(2)),
          occupancyAvg: Number(average(properties.map((row) => row.occupancyAvg)).toFixed(2)),
          revparAvg: Number(average(properties.map((row) => row.revparAvg)).toFixed(2))
        },
        properties
      };
    });
  });

  app.get("/api/pace/anomalies", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, paceAnomaliesSchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const days = Math.min(180, Math.max(14, Math.round(params.days ?? 45)));
      const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const marketKey = normalizeMarketKey(params.cityName, params.countryCode);

      const rows = queryJson<{
        analysis_date: string;
        occupancy_rate: number;
        recommended_rate: number;
        created_at: string;
      }>(`
        SELECT analysis_date, occupancy_rate, recommended_rate, created_at
        FROM analysis_daily
        WHERE property_id = ${sqlQuote(propertyId)}
          AND market_key = ${sqlQuote(marketKey)}
          AND created_at >= ${sqlQuote(cutoffIso)}
        ORDER BY created_at DESC;
      `);

      if (!rows.length) {
        throw new UpstreamError("No pace baseline found for this market", 409, {
          code: "ANALYSIS_REQUIRED",
          propertyId,
          marketKey,
          hint: "Run market analysis to build pace history before checking anomalies."
        });
      }

      const latestByDate = new Map<string, { occupancy: number; rate: number }>();
      rows.forEach((row) => {
        if (!latestByDate.has(row.analysis_date)) {
          latestByDate.set(row.analysis_date, {
            occupancy: Number(row.occupancy_rate || 0),
            rate: Number(row.recommended_rate || 0)
          });
        }
      });

      const series = Array.from(latestByDate.entries())
        .map(([date, value]) => ({ date, occupancy: value.occupancy, rate: value.rate }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const anomalies: Array<{
        date: string;
        occupancy: number;
        baseline: number;
        delta: number;
        severity: "low" | "medium" | "high";
        message: string;
      }> = [];

      for (let idx = 7; idx < series.length; idx += 1) {
        const baseline = average(series.slice(idx - 7, idx).map((row) => row.occupancy));
        const current = series[idx].occupancy;
        const delta = current - baseline;
        if (Math.abs(delta) < 8) {
          continue;
        }
        const severity = Math.abs(delta) >= 15 ? "high" : Math.abs(delta) >= 10 ? "medium" : "low";
        anomalies.push({
          date: series[idx].date,
          occupancy: Number(current.toFixed(2)),
          baseline: Number(baseline.toFixed(2)),
          delta: Number(delta.toFixed(2)),
          severity,
          message:
            delta > 0
              ? "Occupancy is above recent booking pace baseline."
              : "Occupancy is below recent booking pace baseline."
        });
      }

      return {
        propertyId,
        marketKey,
        windowDays: days,
        baselineMethod: "7-day rolling occupancy average",
        anomalies
      };
    });
  });

  app.get("/api/revenue/analytics", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, revenueAnalyticsSchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const days = Math.min(180, Math.max(7, Math.round(params.days ?? 30)));
      const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const marketKey = normalizeMarketKey(params.cityName, params.countryCode);

      const rows = queryJson<{
        analysis_date: string;
        recommended_rate: number;
        anchor_rate: number;
        occupancy_rate: number;
        created_at: string;
      }>(`
        SELECT analysis_date, recommended_rate, anchor_rate, occupancy_rate, created_at
        FROM analysis_daily
        WHERE property_id = ${sqlQuote(propertyId)}
          AND market_key = ${sqlQuote(marketKey)}
          AND created_at >= ${sqlQuote(cutoffIso)}
        ORDER BY created_at DESC;
      `);

      if (!rows.length) {
        throw new UpstreamError("No analytics data found for this market", 409, {
          code: "ANALYSIS_REQUIRED",
          propertyId,
          marketKey,
          hint: "Run market analysis to build analytics history."
        });
      }

      const latestByDate = new Map<string, { adr: number; anchor: number; occupancy: number }>();
      rows.forEach((row) => {
        if (!latestByDate.has(row.analysis_date)) {
          latestByDate.set(row.analysis_date, {
            adr: Number(row.recommended_rate || 0),
            anchor: Number(row.anchor_rate || 0),
            occupancy: Number(row.occupancy_rate || 0)
          });
        }
      });

      const daily = Array.from(latestByDate.entries())
        .map(([date, value]) => ({
          date,
          adr: Number(value.adr.toFixed(2)),
          anchorRate: Number(value.anchor.toFixed(2)),
          occupancy: Number(value.occupancy.toFixed(2)),
          revpar: Number((value.adr * (value.occupancy / 100)).toFixed(2))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const adrValues = daily.map((row) => row.adr);
      const revparValues = daily.map((row) => row.revpar);
      const occupancyValues = daily.map((row) => row.occupancy);
      const firstAdr = adrValues[0] ?? 0;
      const lastAdr = adrValues[adrValues.length - 1] ?? 0;
      const firstRevpar = revparValues[0] ?? 0;
      const lastRevpar = revparValues[revparValues.length - 1] ?? 0;

      return {
        propertyId,
        marketKey,
        windowDays: days,
        daily,
        summary: {
          adrAvg: Number(average(adrValues).toFixed(2)),
          revparAvg: Number(average(revparValues).toFixed(2)),
          occupancyAvg: Number(average(occupancyValues).toFixed(2)),
          adrTrendPct: firstAdr > 0 ? Number((((lastAdr - firstAdr) / firstAdr) * 100).toFixed(2)) : 0,
          revparTrendPct: firstRevpar > 0 ? Number((((lastRevpar - firstRevpar) / firstRevpar) * 100).toFixed(2)) : 0,
          volatilityPct:
            average(adrValues) > 0 ? Number(((stdDev(adrValues) / average(adrValues)) * 100).toFixed(2)) : 0
        }
      };
    });
  });

  app.get("/api/market/history", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, marketHistorySchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const days = Math.min(180, Math.max(7, Math.round(params.days ?? 30)));
      const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const normalizedTargetKey = normalizeMarketKey(params.cityName, params.countryCode);
      const legacyKey = `${params.cityName}-${params.countryCode}`.toLowerCase();

      const runRows = queryJson<{
        market_key: string;
        requested_at: string;
        confidence: string;
        anchor_rate: number;
        recommended_rate: number;
      }>(`
        SELECT market_key, requested_at, confidence, anchor_rate, recommended_rate
        FROM analysis_runs
        WHERE property_id = ${sqlQuote(propertyId)}
          AND requested_at >= ${sqlQuote(cutoffIso)}
        ORDER BY requested_at DESC
        LIMIT 2000;
      `).filter((row) => {
        const normalizedRowKey = normalizeStoredMarketKey(String(row.market_key ?? ""));
        const lowerRawKey = String(row.market_key ?? "").trim().toLowerCase();
        return normalizedRowKey === normalizedTargetKey || lowerRawKey === legacyKey;
      });

      if (!runRows.length) {
        throw new UpstreamError("No historical analysis runs found for this market", 409, {
          code: "ANALYSIS_REQUIRED",
          marketKey: normalizedTargetKey,
          hint: "Run market analysis first to generate historical records."
        });
      }

      const snapshotRows = queryJson<{ collected_at: string; rate: number }>(`
        SELECT collected_at, rate
        FROM compset_snapshots
        WHERE property_id = ${sqlQuote(propertyId)}
          AND lower(city) = ${sqlQuote(params.cityName.trim().toLowerCase())}
          AND collected_at >= ${sqlQuote(cutoffIso)}
        ORDER BY collected_at ASC;
      `);

      const snapshotsByDate = new Map<string, number[]>();
      snapshotRows.forEach((row) => {
        const date = String(row.collected_at ?? "").slice(0, 10);
        const rate = Number(row.rate);
        if (!date || !Number.isFinite(rate) || rate <= 0) return;
        const bucket = snapshotsByDate.get(date) ?? [];
        bucket.push(rate);
        snapshotsByDate.set(date, bucket);
      });

      const sortedSnapshotDates = Array.from(snapshotsByDate.keys()).sort();
      const snapshotSummaryByDate = new Map(
        sortedSnapshotDates.map((date) => {
          const rates = snapshotsByDate.get(date) ?? [];
          return [
            date,
            {
              compsetMedianRate: rates.length ? median(rates) : 0,
              compsetSampleSize: rates.length
            }
          ] as const;
        })
      );

      const runByDate = new Map<string, (typeof runRows)[number]>();
      runRows.forEach((row) => {
        const date = String(row.requested_at ?? "").slice(0, 10);
        if (!date) return;
        if (!runByDate.has(date)) {
          runByDate.set(date, row);
        }
      });

      const daily = Array.from(runByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, row]) => {
          const sameDaySnapshot = snapshotSummaryByDate.get(date);
          const carryForwardSnapshot = sortedSnapshotDates
            .filter((snapshotDate) => snapshotDate <= date)
            .slice(-1)
            .map((snapshotDate) => snapshotSummaryByDate.get(snapshotDate))
            .filter((value): value is { compsetMedianRate: number; compsetSampleSize: number } => Boolean(value))[0];
          const snapshot = sameDaySnapshot ?? carryForwardSnapshot ?? { compsetMedianRate: 0, compsetSampleSize: 0 };
          const confidenceRaw = String(row.confidence ?? "low");
          const confidence =
            confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low"
              ? confidenceRaw
              : "low";

          return {
            date,
            recommendedRate: Number(row.recommended_rate),
            anchorRate: Number(row.anchor_rate),
            confidence,
            compsetMedianRate: Number(snapshot.compsetMedianRate.toFixed(2)),
            compsetSampleSize: snapshot.compsetSampleSize
          };
        });

      const recommendedRates = daily.map((point) => point.recommendedRate);
      const compsetMedians = daily
        .map((point) => point.compsetMedianRate)
        .filter((value) => Number.isFinite(value) && value > 0);
      const firstRate = recommendedRates[0] ?? 0;
      const lastRate = recommendedRates[recommendedRates.length - 1] ?? 0;
      const recommendedTrendPct = firstRate > 0 ? ((lastRate - firstRate) / firstRate) * 100 : 0;
      const recommendedAvg = average(recommendedRates);
      const volatilityPct = recommendedAvg > 0 ? (stdDev(recommendedRates) / recommendedAvg) * 100 : 0;

      return {
        propertyId,
        marketKey: normalizedTargetKey,
        windowDays: days,
        daily,
        summary: {
          recommendedAvg: Number(recommendedAvg.toFixed(2)),
          recommendedTrendPct: Number(recommendedTrendPct.toFixed(2)),
          compsetAvg: Number(average(compsetMedians).toFixed(2)),
          volatilityPct: Number(volatilityPct.toFixed(2))
        }
      };
    });
  });

  app.get("/api/parity/summary", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, paritySummarySchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const tolerancePct = Math.min(10, Math.max(0, Number(params.tolerancePct ?? 2)));
      const cityName = params.cityName.trim();
      const cityLower = cityName.toLowerCase();
      const marketKey = normalizeMarketKey(cityName, params.countryCode);
      const directRate = Number(params.directRate);
      const lowerBound = directRate * (1 - tolerancePct / 100);
      const upperBound = directRate * (1 + tolerancePct / 100);

      const snapshotPointer = queryJson<{ collected_at: string }>(`
        SELECT collected_at
        FROM compset_snapshots
        WHERE property_id = ${sqlQuote(propertyId)}
          AND lower(city) = ${sqlQuote(cityLower)}
          AND check_in = ${sqlQuote(params.checkInDate)}
          AND check_out = ${sqlQuote(params.checkOutDate)}
        ORDER BY collected_at DESC
        LIMIT 1;
      `)[0];

      if (!snapshotPointer?.collected_at) {
        throw new UpstreamError("No compset snapshot found for requested parity window", 409, {
          code: "ANALYSIS_REQUIRED",
          marketKey,
          hint: "Run market analysis for this date range before checking parity."
        });
      }

      const parityRows = queryJson<{ hotel_name: string; ota: string; rate: number }>(`
        SELECT hotel_name, ota, rate
        FROM compset_snapshots
        WHERE property_id = ${sqlQuote(propertyId)}
          AND lower(city) = ${sqlQuote(cityLower)}
          AND check_in = ${sqlQuote(params.checkInDate)}
          AND check_out = ${sqlQuote(params.checkOutDate)}
          AND collected_at = ${sqlQuote(snapshotPointer.collected_at)}
        ORDER BY rate ASC;
      `);

      if (!parityRows.length) {
        throw new UpstreamError("No compset rates found for parity evaluation", 409, {
          code: "ANALYSIS_REQUIRED",
          marketKey,
          hint: "Run market analysis for this date range before checking parity."
        });
      }

      const rows = parityRows
        .map((row) => {
          const rate = Number(row.rate);
          if (!Number.isFinite(rate) || rate <= 0) return null;

          const delta = rate - directRate;
          const deltaPct = directRate > 0 ? (delta / directRate) * 100 : 0;
          const classification = rate < lowerBound ? "undercut" : rate > upperBound ? "overcut" : "parity";

          return {
            hotelName: String(row.hotel_name ?? "Unknown hotel"),
            ota: String(row.ota ?? "unknown"),
            rate: Number(rate.toFixed(2)),
            delta: Number(delta.toFixed(2)),
            deltaPct: Number(deltaPct.toFixed(2)),
            classification
          };
        })
        .filter(
          (row): row is {
            hotelName: string;
            ota: string;
            rate: number;
            delta: number;
            deltaPct: number;
            classification: "undercut" | "parity" | "overcut";
          } => Boolean(row)
        );

      const undercutRows = rows.filter((row) => row.classification === "undercut");
      const parityCount = rows.filter((row) => row.classification === "parity").length;
      const overcutCount = rows.filter((row) => row.classification === "overcut").length;
      const undercutPct = rows.length ? (undercutRows.length / rows.length) * 100 : 0;
      const riskLevel = undercutPct >= 60 ? "high" : undercutPct >= 30 ? "medium" : "low";

      const alerts = undercutRows
        .sort((a, b) => a.deltaPct - b.deltaPct)
        .slice(0, 12)
        .map((row) => ({
          hotelName: row.hotelName,
          ota: row.ota,
          rate: row.rate,
          delta: row.delta,
          deltaPct: row.deltaPct,
          severity: row.deltaPct <= -15 ? "high" : row.deltaPct <= -7 ? "medium" : "low"
        }));

      const rates = rows.map((row) => row.rate);

      return {
        propertyId,
        marketKey,
        directRate: Number(directRate.toFixed(2)),
        tolerancePct: Number(tolerancePct.toFixed(2)),
        snapshotAt: snapshotPointer.collected_at,
        summary: {
          undercutCount: undercutRows.length,
          parityCount,
          overcutCount,
          undercutPct: Number(undercutPct.toFixed(2)),
          minRate: Number(Math.min(...rates).toFixed(2)),
          medianRate: Number(median(rates).toFixed(2)),
          maxRate: Number(Math.max(...rates).toFixed(2)),
          riskLevel
        },
        alerts
      };
    });
  });

  app.get("/api/market/analysis", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, marketAnalysisSchema);
      const propertyId = sanitizePropertyId(params.propertyId);
      const property = requirePropertyById(propertyId);

      const cityName = params.cityName?.trim() || property.cityName || config.demoCity;
      const cityCode = params.cityCode?.trim().toUpperCase() || null;
      const latitude = Number(params.latitude ?? property.latitude ?? config.demoLatitude);
      const longitude = Number(params.longitude ?? property.longitude ?? config.demoLongitude);
      const hotelType = normalizeHotelType(params.hotelType ?? property.hotelType);
      const estimatedOccupancy = Math.min(99, Math.max(15, Math.round(params.estimatedOccupancy ?? 68)));
      const adults = Math.max(1, Math.round(params.adults ?? 2));
      const daysForward = Math.min(90, Math.max(7, Math.round(params.daysForward ?? config.analysisDaysForward)));
      const targetMarketPosition = Math.min(1, Math.max(0, params.targetMarketPosition ?? 0.5));
      const minPrice = Math.max(30, Math.round(params.minPrice ?? 90));
      const maxPrice = Math.max(minPrice + 20, Math.round(params.maxPrice ?? 650));
      const totalRooms = Math.max(10, Math.round(params.totalRooms ?? property.totalRooms ?? 40));
      const useSuggestedCompset = Boolean(params.useSuggestedCompset);

      const dateRange = Array.from({ length: daysForward }).map((_, idx) =>
        format(addDays(parseISO(params.checkInDate), idx), "yyyy-MM-dd")
      );
      const endDate = dateRange[dateRange.length - 1];

      const warnings: string[] = [];
      const fallbacksUsed = new Set<string>();
      const sourceDiagnostics: Record<
        "Hotels" | "Events" | "Holidays" | "Weather" | "Trends" | "Flights" | "PMS" | "University",
        SourceHealthDiagnostics
      > = {
        Hotels: { degraded: false, errors: [], hasData: false },
        Events: { degraded: false, errors: [], hasData: false },
        Holidays: { degraded: false, errors: [], hasData: false },
        Weather: { degraded: false, errors: [], hasData: false },
        Trends: { degraded: false, errors: [], hasData: false },
        Flights: { degraded: false, errors: [], hasData: false },
        PMS: { degraded: false, errors: [], hasData: false },
        University: { degraded: false, errors: [], hasData: false }
      };
      let compsetSource: "makcorps" | "amadeus" | "fallback" = "fallback";

      let compsetHotels: Array<{
        hotelId: string;
        hotelName: string;
        medianRate: number;
        otaRates: Array<{ ota: string; rate: number; currency: string }>;
      }> = [];

      try {
        const mkHotels = await searchMakcorpsCompset({
          city: cityName,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          maxResults: 10
        });
        if (mkHotels.length) {
          compsetSource = "makcorps";
          compsetHotels = mkHotels.map((hotel) => ({
            hotelId: hotel.hotelId,
            hotelName: hotel.hotelName,
            medianRate: hotel.medianRate,
            otaRates: hotel.otaRates
          }));
          sourceDiagnostics.Hotels.hasData = true;
        }
      } catch (error) {
        const message = `Makcorps unavailable: ${toApiError(error).message}`;
        warnings.push(message);
        sourceDiagnostics.Hotels.degraded = true;
        sourceDiagnostics.Hotels.errors.push(message);
      }

      if (!compsetHotels.length) {
        try {
          const hotelsByGeo = await amadeusGet<{ data?: Array<{ hotelId: string; name: string }> }>(
            "/v1/reference-data/locations/hotels/by-geocode",
            { latitude, longitude, radius: 12, radiusUnit: "KM" }
          );

          const hotelIds = (hotelsByGeo.data ?? []).slice(0, 10).map((hotel) => hotel.hotelId).join(",");
          if (hotelIds) {
            const offers = await amadeusGet<{
              data?: Array<{
                hotel?: { hotelId?: string; name?: string };
                offers?: Array<{ price?: { total?: string; variations?: { average?: { base?: string } } } }>;
              }>;
            }>("/v3/shopping/hotel-offers", {
              hotelIds,
              adults,
              checkInDate: params.checkInDate,
              checkOutDate: params.checkOutDate,
              bestRateOnly: true
            });

            const normalized = (offers.data ?? [])
              .map((entry) => {
                const offer = entry.offers?.[0];
                const rate = Number(offer?.price?.variations?.average?.base ?? offer?.price?.total);
                if (!Number.isFinite(rate) || rate <= 0) {
                  return null;
                }
                return {
                  hotelId: entry.hotel?.hotelId ?? `amadeus-${entry.hotel?.name ?? "hotel"}`,
                  hotelName: entry.hotel?.name ?? "Amadeus competitor",
                  medianRate: rate,
                  otaRates: [{ ota: "amadeus", rate, currency: "USD" }]
                };
              })
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

            if (normalized.length) {
              compsetSource = "amadeus";
              compsetHotels = normalized;
              sourceDiagnostics.Hotels.hasData = true;
              sourceDiagnostics.Hotels.degraded = true;
              fallbacksUsed.add("makcorps_fallback_amadeus");
            }
          }
        } catch (error) {
          const message = `Amadeus compset fallback unavailable: ${toApiError(error).message}`;
          warnings.push(message);
          sourceDiagnostics.Hotels.errors.push(message);
        }
      }

      if (!compsetHotels.length) {
        fallbacksUsed.add("compset_fallback_static");
        sourceDiagnostics.Hotels.degraded = true;
        sourceDiagnostics.Hotels.hasData = true;
        compsetHotels = [
          {
            hotelId: "fallback-1",
            hotelName: `${cityName} baseline market`,
            medianRate: 220,
            otaRates: [{ ota: "fallback", rate: 220, currency: "USD" }]
          }
        ];
      }

      let compsetSuggestionVersion: string | null = null;
      if (useSuggestedCompset && compsetHotels.length > 1) {
        const suggestions = suggestCompsetCandidates({
          latitude,
          longitude,
          anchorRate: average(compsetHotels.map((hotel) => hotel.medianRate)),
          demandIndex: estimatedOccupancy,
          maxResults: Math.min(8, compsetHotels.length),
          candidates: compsetHotels.map((hotel) => ({
            hotelId: hotel.hotelId,
            hotelName: hotel.hotelName,
            averageRate: hotel.medianRate,
            sampleSize: hotel.otaRates.length
          }))
        });

        if (suggestions.length) {
          const rank = new Map(suggestions.map((item, index) => [item.hotelId, index] as const));
          const selectedIds = new Set(suggestions.map((item) => item.hotelId));
          compsetHotels = compsetHotels
            .filter((hotel) => selectedIds.has(hotel.hotelId))
            .sort((a, b) => (rank.get(a.hotelId) ?? 999) - (rank.get(b.hotelId) ?? 999));
          compsetSuggestionVersion = "v1";
        }
      }

      const flattenedCompset = compsetHotels.flatMap((hotel) =>
        hotel.otaRates.map((ota) => ({
          hotelId: hotel.hotelId,
          hotelName: hotel.hotelName,
          rate: ota.rate,
          ota: ota.ota
        }))
      );

      saveCompsetSnapshot(propertyId, cityName, params.checkInDate, params.checkOutDate, flattenedCompset);

      const pmsResult = await resolvePmsPace({
        cityName,
        checkInDate: params.checkInDate,
        daysForward,
        hotelType,
        totalRooms,
        seed: `${cityName}-${params.countryCode}-${params.checkInDate}`
      });
      const paceRows = pmsResult.pace;
      sourceDiagnostics.PMS.hasData = paceRows.length > 0;
      if (pmsResult.fallbackUsed && pmsResult.fallbackFlag) {
        sourceDiagnostics.PMS.degraded = true;
        sourceDiagnostics.PMS.errors.push(pmsResult.healthMessage);
        fallbacksUsed.add(pmsResult.fallbackFlag);
      }
      const paceByDate = new Map(paceRows.map((entry) => [entry.date, entry]));

      const holidayYears = new Set([parseISO(params.checkInDate).getFullYear(), parseISO(endDate).getFullYear()]);
      let holidayPayloads: Array<{
        publicHolidays: Array<Record<string, unknown>>;
        longWeekends: Array<Record<string, unknown>>;
      }> = [];
      try {
        holidayPayloads = await Promise.all(
          Array.from(holidayYears).map(async (year) => {
            const [publicHolidays, longWeekends] = await Promise.all([
              fetchJsonCached<unknown>(
                `${config.nagerBaseUrl}/PublicHolidays/${year}/${params.countryCode}`,
                {},
                "Nager public holidays request failed",
                CACHE_TTL.holidaysMs
              ),
              fetchJsonCached<unknown>(
                `${config.nagerBaseUrl}/LongWeekend/${year}/${params.countryCode}`,
                {},
                "Nager long weekend request failed",
                CACHE_TTL.holidaysMs
              )
            ]);
            return {
              publicHolidays: normalizeArrayPayload<Record<string, unknown>>(publicHolidays),
              longWeekends: normalizeArrayPayload<Record<string, unknown>>(longWeekends)
            };
          })
        );
        sourceDiagnostics.Holidays.hasData = true;
      } catch (error) {
        const message = `Holidays feed unavailable: ${toApiError(error).message}`;
        warnings.push(message);
        sourceDiagnostics.Holidays.degraded = true;
        sourceDiagnostics.Holidays.errors.push(message);
      }

      const holidayDates = new Set<string>();
      holidayPayloads.flatMap((entry) => entry.publicHolidays).forEach((holiday) => {
        if (typeof holiday.date !== "string") return;
        if (!Array.isArray(holiday.types)) return;
        const types = holiday.types.filter((value): value is string => typeof value === "string");
        if (!types.some((type) => type === "Public" || type === "Bank")) return;
        holidayDates.add(holiday.date);
      });

      const longWeekendDates = new Set<string>();
      holidayPayloads.flatMap((entry) => entry.longWeekends).forEach((weekend) => {
        if (typeof weekend.startDate !== "string" || typeof weekend.endDate !== "string") return;
        const start = parseISO(weekend.startDate);
        const end = parseISO(weekend.endDate);
        const span = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        for (let idx = 0; idx <= span; idx += 1) {
          longWeekendDates.add(format(addDays(start, idx), "yyyy-MM-dd"));
        }
      });

      let weatherSummary: ReturnType<typeof toWeatherSummary> = [];
      try {
        const weatherPayload = await fetchJsonCached<unknown>(
          buildUrl("https://api.openweathermap.org/data/2.5", "/forecast", {
            lat: latitude,
            lon: longitude,
            appid: config.openWeatherApiKey,
            units: "metric"
          }),
          {},
          "OpenWeather forecast request failed",
          CACHE_TTL.weatherMs
        );
        weatherSummary = toWeatherSummary(weatherPayload);
        sourceDiagnostics.Weather.hasData = true;
      } catch (error) {
        const message = `Weather feed unavailable: ${toApiError(error).message}`;
        warnings.push(message);
        sourceDiagnostics.Weather.degraded = true;
        sourceDiagnostics.Weather.errors.push(message);
      }
      const weatherByDate = new Map(weatherSummary.map((entry) => [entry.date, entry.category as V2WeatherCategory]));

      let events: TicketmasterEvent[] = [];
      const eventImpactByDate = new Map<string, number>();

      try {
        const predictEvents = await searchPredictHQEvents({
          latitude,
          longitude,
          startDate: `${params.checkInDate}T00:00:00Z`,
          endDate: `${endDate}T23:59:59Z`,
          radiusKm: 8,
          rankGte: 40
        });

        if (predictEvents.length) {
          events = predictEvents.map((event) => ({
            id: event.id,
            name: event.title,
            date: event.start,
            status: "onsale",
            segment: event.category,
            genre: event.category,
            venueName: event.title,
            venueLatitude: event.latitude,
            venueLongitude: event.longitude,
            popularityScore: event.impactScore,
            minPrice: undefined,
            maxPrice: undefined,
            currency: "USD"
          }));

          predictEvents.forEach((event) => {
            const key = normalizeEventDate(event.start);
            const current = eventImpactByDate.get(key) ?? 0;
            eventImpactByDate.set(key, Math.max(current, event.impactScore));
          });
        }
        sourceDiagnostics.Events.hasData = true;
      } catch (error) {
        const message = `PredictHQ unavailable: ${toApiError(error).message}`;
        warnings.push(message);
        sourceDiagnostics.Events.degraded = true;
        sourceDiagnostics.Events.errors.push(message);
      }

      if (!events.length) {
        try {
          const fallbackEvents = await fetchTicketmasterEvents({
            latitude,
            longitude,
            startDateTime: `${params.checkInDate}T00:00:00Z`,
            endDateTime: `${endDate}T23:59:59Z`,
            size: 100,
            sort: "date,asc"
          });

          events = (fallbackEvents._embedded?.events ?? []).map((event) => normalizeTicketmasterEvent(event));
          events.forEach((event) => {
            const key = normalizeEventDate(event.date);
            const scaled = Math.min(100, Math.round(event.popularityScore * 2.2));
            eventImpactByDate.set(key, Math.max(eventImpactByDate.get(key) ?? 0, scaled));
          });
          sourceDiagnostics.Events.hasData = true;
          sourceDiagnostics.Events.degraded = true;
          fallbacksUsed.add("predicthq_fallback_ticketmaster");
        } catch (error) {
          const message = `Ticketmaster fallback unavailable: ${toApiError(error).message}`;
          warnings.push(message);
          sourceDiagnostics.Events.errors.push(message);
        }
      }

      let trendsSignal: TrendsSignal = {
        current7dAvg: 0,
        baseline28dAvg: 0,
        momentumRatio: 1,
        searchMomentumIndex: 50,
        searchDemandMultiplier: 1,
        source: "fallback" as const
      };

      try {
        trendsSignal = await getSerpApiTrendsSignal({
          cityName,
          countryCode: params.countryCode
        });
        sourceDiagnostics.Trends.hasData = true;
        if (trendsSignal.source === "fallback") {
          sourceDiagnostics.Trends.degraded = true;
          sourceDiagnostics.Trends.errors.push("Google Trends payload was incomplete; using neutral fallback.");
          fallbacksUsed.add("trends_fallback_neutral");
        }
      } catch (error) {
        const message = `Google Trends unavailable: ${toApiError(error).message}`;
        warnings.push(message);
        sourceDiagnostics.Trends.hasData = true;
        sourceDiagnostics.Trends.degraded = true;
        sourceDiagnostics.Trends.errors.push(message);
        fallbacksUsed.add("trends_fallback_neutral");
      }

      let flightSignal: FlightDemandSignal = {
        destinationIata: null as string | null,
        pricePressureScore: 50,
        supplyInterestScore: 50,
        flightDemandIndex: 50,
        travelIntentMultiplier: 1,
        source: "fallback" as const
      };

      try {
        flightSignal = await getAmadeusFlightDemandSignal({
          cityName,
          countryCode: params.countryCode,
          cityCode,
          checkInDate: params.checkInDate
        });
        sourceDiagnostics.Flights.hasData = true;
        if (flightSignal.source === "fallback") {
          sourceDiagnostics.Flights.degraded = true;
          sourceDiagnostics.Flights.errors.push("Flight-demand signal unavailable; using neutral fallback.");
          fallbacksUsed.add("flight_demand_fallback_neutral");
        }
      } catch (error) {
        const message = `Flight-demand signal unavailable: ${toApiError(error).message}`;
        warnings.push(message);
        sourceDiagnostics.Flights.hasData = true;
        sourceDiagnostics.Flights.degraded = true;
        sourceDiagnostics.Flights.errors.push(message);
        fallbacksUsed.add("flight_demand_fallback_neutral");
      }

      const universitySignal = getUniversityDemandSignal({
        cityName,
        countryCode: params.countryCode,
        analysisDates: dateRange
      });
      sourceDiagnostics.University.hasData = true;
      if (universitySignal.source === "fallback") {
        sourceDiagnostics.University.degraded = true;
        sourceDiagnostics.University.errors.push("No curated university calendar for this market; using neutral baseline.");
        fallbacksUsed.add("university_fallback_none");
      }

      const supplySource = "fallback_proxy" as const;

      const engineSignals = dateRange.map((date) => ({
        date,
        weatherCategory: weatherByDate.get(date) ?? "cloudy",
        eventImpactScore: eventImpactByDate.get(date) ?? 0,
        isHoliday: holidayDates.has(date),
        isLongWeekend: longWeekendDates.has(date),
        searchDemandMultiplier: trendsSignal.searchDemandMultiplier,
        travelIntentMultiplier: flightSignal.travelIntentMultiplier,
        campusDemandMultiplier: universitySignal.campusDemandByDate[date]?.multiplier ?? 1,
        pace:
          paceByDate.get(date) ?? {
            date,
            roomsBooked: Math.round(totalRooms * (estimatedOccupancy / 100)),
            roomsAvailable: totalRooms - Math.round(totalRooms * (estimatedOccupancy / 100)),
            occupancyRate: estimatedOccupancy,
            pickupLast7Days: 2,
            occupancyLastYear: estimatedOccupancy - 5
          }
      }));

      const engineOutput = calculateV2Recommendations({
        compsetRates: flattenedCompset.map((entry) => entry.rate),
        targetMarketPosition,
        minPrice,
        maxPrice,
        hotelType,
        signals: engineSignals
      });

      const pricing = engineOutput.recommendations.map((entry) => ({
        date: entry.date,
        baseRate: entry.baseRate,
        finalRate: entry.finalRate,
        finalMultiplier: entry.finalMultiplier,
        rawMultiplier: entry.rawMultiplier,
        factors: entry.factors
      }));

      const pricingReasonsByDate = Object.fromEntries(
        engineOutput.recommendations.map((entry) => [entry.date, entry.reasons])
      );
      const explainabilityByDate = Object.fromEntries(
        engineOutput.recommendations.map((entry) => [entry.date, entry.explainability])
      );

      const hotelsErrorSummary =
        sourceDiagnostics.Hotels.errors[0] ??
        (fallbacksUsed.has("compset_fallback_static")
          ? "Using static compset baseline fallback."
          : fallbacksUsed.has("makcorps_fallback_amadeus")
            ? "Makcorps unavailable; using Amadeus compset fallback."
            : undefined);
      const eventsErrorSummary =
        sourceDiagnostics.Events.errors[0] ??
        (fallbacksUsed.has("predicthq_fallback_ticketmaster")
          ? "PredictHQ unavailable; using Ticketmaster fallback."
          : undefined);
      const trendsErrorSummary =
        sourceDiagnostics.Trends.errors[0] ??
        (fallbacksUsed.has("trends_fallback_neutral") ? "Using neutral search-demand fallback." : undefined);
      const flightsErrorSummary =
        sourceDiagnostics.Flights.errors[0] ??
        (fallbacksUsed.has("flight_demand_fallback_neutral")
          ? "Using neutral flight-demand fallback."
          : undefined);
      const pmsErrorSummary =
        sourceDiagnostics.PMS.errors[0] ??
        (fallbacksUsed.has("pms_fallback_simulated")
          ? "Cloudbeds disabled in this deployment; using simulated PMS pace."
          : undefined);
      const universityErrorSummary =
        sourceDiagnostics.University.errors[0] ??
        (fallbacksUsed.has("university_fallback_none")
          ? "No curated university calendar for selected market."
          : undefined);

      const sourceHealth = [
        {
          source: "Hotels",
          status: resolveSourceStatus(sourceDiagnostics.Hotels),
          errorSummary: hotelsErrorSummary,
          lastUpdated: new Date().toISOString()
        },
        {
          source: "Events",
          status: resolveSourceStatus(sourceDiagnostics.Events),
          errorSummary: eventsErrorSummary,
          lastUpdated: new Date().toISOString()
        },
        {
          source: "Holidays",
          status: resolveSourceStatus(sourceDiagnostics.Holidays),
          errorSummary: sourceDiagnostics.Holidays.errors[0],
          lastUpdated: new Date().toISOString()
        },
        {
          source: "Weather",
          status: resolveSourceStatus(sourceDiagnostics.Weather),
          errorSummary: sourceDiagnostics.Weather.errors[0],
          lastUpdated: new Date().toISOString()
        },
        {
          source: "Trends",
          status: resolveSourceStatus(sourceDiagnostics.Trends),
          errorSummary: trendsErrorSummary,
          lastUpdated: new Date().toISOString()
        },
        {
          source: "Flights",
          status: resolveSourceStatus(sourceDiagnostics.Flights),
          errorSummary: flightsErrorSummary,
          lastUpdated: new Date().toISOString()
        },
        {
          source: "PMS",
          status: resolveSourceStatus(sourceDiagnostics.PMS),
          errorSummary: pmsErrorSummary,
          lastUpdated: new Date().toISOString()
        },
        {
          source: "University",
          status: resolveSourceStatus(sourceDiagnostics.University),
          errorSummary: universityErrorSummary,
          lastUpdated: new Date().toISOString()
        }
      ] as const;

      const adr = average(pricing.map((entry) => entry.finalRate));
      const occupancy = average(paceRows.map((entry) => entry.occupancyRate)) || estimatedOccupancy;
      const revpar = adr * (occupancy / 100);
      const activeMultiplier = pricing[0]?.finalMultiplier ?? 1;
      const previousWindow = pricing.slice(7, 14);
      const previousAdr = average(previousWindow.map((entry) => entry.finalRate)) || adr;
      const previousRevpar = previousAdr * (occupancy / 100);
      const previousMultiplier = average(previousWindow.map((entry) => entry.finalMultiplier)) || activeMultiplier;
      const currentEventDays = dateRange.filter((date) => (eventImpactByDate.get(date) ?? 0) >= 40).length;

      const compsetSummary = summarizeRates(flattenedCompset.map((entry) => entry.rate));
      const deltaVsMedian = pricing[0] ? pricing[0].finalRate - compsetSummary.medianRate : 0;
      const usage = getUsageSummary();
      const baseDataConfidence = engineOutput.confidence === "high" ? 88 : engineOutput.confidence === "medium" ? 68 : 45;
      const degradedCount = sourceHealth.filter((row) => row.status !== "ok").length;
      const dataConfidence = Math.max(20, Math.min(98, baseDataConfidence - degradedCount * 8));
      const missingSources = sourceHealth
        .filter((row) => row.status === "error")
        .map((row) => row.source);
      const availableSources = sourceHealth.filter((row) => row.status !== "error").length;
      const demandPressureIndex = Math.min(
        100,
        Math.round(
          occupancy * 0.35 +
            currentEventDays * 5 +
            (holidayDates.size > 0 ? 8 : 0) +
            trendsSignal.searchMomentumIndex * 0.2 +
            flightSignal.flightDemandIndex * 0.2 +
            universitySignal.campusDemandDays * 3
        )
      );
      const demandInsightIndex = Math.min(
        100,
        Math.round(
          occupancy * 0.4 +
            currentEventDays * 5 +
            trendsSignal.searchMomentumIndex * 0.25 +
            flightSignal.flightDemandIndex * 0.25
        )
      );

      const model = {
        pricing,
        events,
        weather: weatherSummary,
        kpis: {
          adr,
          revpar,
          occupancy,
          activeMultiplier,
          adrDeltaPct: previousAdr ? ((adr - previousAdr) / previousAdr) * 100 : 0,
          revparDeltaPct: previousRevpar ? ((revpar - previousRevpar) / previousRevpar) * 100 : 0,
          occupancyDeltaPct: 0,
          activeMultiplierDelta: activeMultiplier - previousMultiplier,
          demandPressureIndex,
          dataConfidence
        },
        insights: {
          demand: {
            index: demandInsightIndex,
            level: occupancy >= 80 ? "high" : occupancy >= 60 ? "moderate" : "low",
            occupancySignal: occupancy,
            eventSignal: Math.min(100, currentEventDays * 10),
            holidaySignal: Math.min(100, holidayDates.size * 8),
            leadTimeSignal: 65
          },
          dataQuality: {
            confidenceScore: dataConfidence,
            availableSources,
            totalSources: 8,
            hasApiErrors: sourceHealth.some((row) => row.status !== "ok"),
            missingSources
          },
          actions: [
            {
              id: "market-anchor",
              action: deltaVsMedian < -10 ? "raise" : deltaVsMedian > 15 ? "lower" : "hold",
              title: deltaVsMedian < -10 ? "Move closer to compset median" : deltaVsMedian > 15 ? "Protect conversion with tactical discounting" : "Hold position near compset median",
              rationale: `Current recommendation is ${deltaVsMedian >= 0 ? "$" : "-$"}${Math.abs(Math.round(deltaVsMedian))} vs compset median.`,
              expectedAdrImpact: deltaVsMedian < -10 ? 12 : deltaVsMedian > 15 ? -10 : 3,
              expectedRevparImpact: deltaVsMedian < -10 ? 8 : deltaVsMedian > 15 ? -6 : 2,
              confidence: dataConfidence
            }
          ],
          signals: {
            eventDays: currentEventDays,
            holidayDays: dateRange.filter((date) => holidayDates.has(date)).length,
            longWeekendDays: dateRange.filter((date) => longWeekendDates.has(date)).length,
            weatherRiskDays: dateRange.filter((date) => {
              const category = weatherByDate.get(date);
              return category === "storm" || category === "rain" || category === "snow";
            }).length,
            highDemandDays: pricing.filter((entry) => entry.finalMultiplier >= 1.25).length,
            searchMomentumIndex: trendsSignal.searchMomentumIndex,
            flightDemandIndex: flightSignal.flightDemandIndex,
            campusDemandDays: universitySignal.campusDemandDays
          }
        },
        marketAnchor: {
          anchorRate: engineOutput.anchorRate,
          compsetMedian: engineOutput.compsetMedian,
          compsetP25: engineOutput.compsetP25,
          compsetP75: engineOutput.compsetP75,
          targetMarketPosition,
          source: compsetSource
        },
        compsetPosition: {
          recommendedRate: pricing[0]?.finalRate ?? engineOutput.anchorRate,
          deltaVsMedian,
          percentileBand:
            (pricing[0]?.finalRate ?? engineOutput.anchorRate) < engineOutput.compsetP25
              ? "below_p25"
              : (pricing[0]?.finalRate ?? engineOutput.anchorRate) > engineOutput.compsetP75
                ? "above_p75"
                : "mid_band"
        },
        recommendationConfidence: {
          level: engineOutput.confidence,
          score: dataConfidence,
          reason:
            engineOutput.confidence === "high"
              ? "Compset + pace + demand signals available."
              : engineOutput.confidence === "medium"
                ? "Partial market and demand coverage."
                : "Limited compset data, using fallbacks."
        },
        providerUsage: usage.providers,
        compset: {
          source: compsetSource,
          hotels: compsetHotels,
          summary: {
            medianRate: compsetSummary.medianRate,
            averageRate: compsetSummary.averageRate,
            sampleSize: compsetSummary.sampleSize
          }
        }
      };

      const normalizedMarketKey = normalizeMarketKey(cityName, params.countryCode);
      const persistedRun = saveAnalysisRun(
        propertyId,
        normalizedMarketKey,
        model.recommendationConfidence.level,
        model.marketAnchor.anchorRate,
        model.compsetPosition.recommendedRate,
        {
          propertyId,
          cityName,
          warnings,
          fallbacksUsed: Array.from(fallbacksUsed),
          usage,
          kpis: model.kpis
        }
      );
      const signalByDate = new Map(engineSignals.map((signal) => [signal.date, signal] as const));
      saveAnalysisDailyRows(
        persistedRun.id,
        propertyId,
        normalizedMarketKey,
        persistedRun.requestedAt,
        engineOutput.recommendations.map((entry) => ({
          date: entry.date,
          recommendedRate: entry.finalRate,
          anchorRate: engineOutput.anchorRate,
          occupancyRate: signalByDate.get(entry.date)?.pace.occupancyRate ?? estimatedOccupancy,
          finalMultiplier: entry.finalMultiplier,
          rawMultiplier: entry.rawMultiplier,
          eventImpact: signalByDate.get(entry.date)?.eventImpactScore ?? 0,
          weatherCategory: signalByDate.get(entry.date)?.weatherCategory ?? "cloudy"
        }))
      );

      return {
        generatedAt: new Date().toISOString(),
        warnings,
        propertyId,
        analysisContext: {
          propertyId,
          cityName,
          countryCode: params.countryCode,
          hotelType,
          daysForward,
          runMode: "fallback_first",
          phase: "phase2_wave1",
          pmsMode: pmsResult.modeUsed
        },
        paceSource: pmsResult.modeUsed,
        pmsSyncAt: pmsResult.pmsSyncAt,
        supplySource,
        compsetSuggestionVersion,
        fallbacksUsed: Array.from(fallbacksUsed),
        usage,
        model,
        sourceHealth,
        pricingReasonsByDate,
        explainabilityByDate,
        eventDates: Array.from(new Set(events.map((event) => normalizeEventDate(event.date)))),
        holidayDates: Array.from(holidayDates),
        longWeekendDates: Array.from(longWeekendDates),
        highDemandDates: pricing.filter((entry) => entry.finalMultiplier >= 1.25).map((entry) => entry.date)
      };
    });
  });
}
