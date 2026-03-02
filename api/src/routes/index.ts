import type { Express, Response } from "express";
import { addDays, format, parseISO } from "date-fns";
import ngeohash from "ngeohash";
import { z } from "zod";
import { config } from "../config.js";
import { amadeusGet } from "../lib/amadeus.js";
import { executeSql, queryJson, sqlQuote } from "../lib/db.js";
import { generatePaceSimulation } from "../lib/paceSimulator.js";
import { calculateV2Recommendations, summarizeRates, type V2WeatherCategory } from "../lib/priceEngineV2.js";
import { buildUrl, fetchJsonCached, RequestValidationError, toApiError, UpstreamError } from "../lib/http.js";
import { resolvePmsPace } from "../lib/pms/adapter.js";
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
  totalRooms: zOptionalNumber
});

const marketHistorySchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  days: zOptionalNumber
});

const paritySummarySchema = z.object({
  cityName: zRequiredString,
  countryCode: zRequiredString,
  checkInDate: zRequiredString,
  checkOutDate: zRequiredString,
  directRate: z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    z.coerce.number().finite().positive()
  ),
  tolerancePct: zOptionalNumber
});

const paceSimulationBodySchema = z.object({
  totalRooms: z.coerce.number().int().positive().max(2000).default(40),
  daysForward: z.coerce.number().int().min(7).max(180).default(90),
  hotelType: z.enum(["city", "business", "leisure", "beach", "ski"]).default("city"),
  seed: z.string().trim().min(1).optional(),
  startDate: z.string().trim().min(1).optional()
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

function saveCompsetSnapshot(city: string, checkInDate: string, checkOutDate: string, rows: Array<{
  hotelId: string;
  hotelName: string;
  rate: number;
  ota: string;
}>) {
  const collectedAt = new Date().toISOString();
  rows.forEach((row) => {
    executeSql(`
      INSERT INTO compset_snapshots(city, check_in, check_out, hotel_name, hotel_id, rate, ota, collected_at)
      VALUES (
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

function saveAnalysisRun(marketKey: string, confidence: string, anchorRate: number, recommendedRate: number, payload: unknown) {
  executeSql(`
    INSERT INTO analysis_runs(market_key, requested_at, confidence, anchor_rate, recommended_rate, payload_json)
    VALUES (
      ${sqlQuote(marketKey)},
      ${sqlQuote(new Date().toISOString())},
      ${sqlQuote(confidence)},
      ${Number(anchorRate)},
      ${Number(recommendedRate)},
      ${sqlQuote(JSON.stringify(payload))}
    );
  `);
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

  app.get("/api/market/history", async (req, res) => {
    await withRoute(res, async () => {
      const params = validateQuery(req, marketHistorySchema);
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
        WHERE requested_at >= ${sqlQuote(cutoffIso)}
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
        WHERE lower(city) = ${sqlQuote(params.cityName.trim().toLowerCase())}
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
        WHERE lower(city) = ${sqlQuote(cityLower)}
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
        WHERE lower(city) = ${sqlQuote(cityLower)}
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

      const cityName = params.cityName ?? config.demoCity;
      const cityCode = params.cityCode?.trim().toUpperCase() || null;
      const latitude = Number(params.latitude);
      const longitude = Number(params.longitude);
      const hotelType = (params.hotelType ?? "city") as "city" | "business" | "leisure" | "beach" | "ski";
      const estimatedOccupancy = Math.min(99, Math.max(15, Math.round(params.estimatedOccupancy ?? 68)));
      const adults = Math.max(1, Math.round(params.adults ?? 2));
      const daysForward = Math.min(90, Math.max(7, Math.round(params.daysForward ?? config.analysisDaysForward)));
      const targetMarketPosition = Math.min(1, Math.max(0, params.targetMarketPosition ?? 0.5));
      const minPrice = Math.max(30, Math.round(params.minPrice ?? 90));
      const maxPrice = Math.max(minPrice + 20, Math.round(params.maxPrice ?? 650));
      const totalRooms = Math.max(10, Math.round(params.totalRooms ?? 40));

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

      const flattenedCompset = compsetHotels.flatMap((hotel) =>
        hotel.otaRates.map((ota) => ({
          hotelId: hotel.hotelId,
          hotelName: hotel.hotelName,
          rate: ota.rate,
          ota: ota.ota
        }))
      );

      saveCompsetSnapshot(cityName, params.checkInDate, params.checkOutDate, flattenedCompset);

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
          ? "Cloudbeds unavailable; using simulated PMS pace."
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

      saveAnalysisRun(
        normalizeMarketKey(cityName, params.countryCode),
        model.recommendationConfidence.level,
        model.marketAnchor.anchorRate,
        model.compsetPosition.recommendedRate,
        {
          cityName,
          warnings,
          fallbacksUsed: Array.from(fallbacksUsed),
          usage
        }
      );

      return {
        generatedAt: new Date().toISOString(),
        warnings,
        analysisContext: {
          cityName,
          countryCode: params.countryCode,
          hotelType,
          daysForward,
          runMode: "fallback_first",
          phase: "phase2_wave1",
          pmsMode: pmsResult.modeUsed
        },
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
