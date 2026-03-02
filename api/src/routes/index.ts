import type { Express, Response } from "express";
import ngeohash from "ngeohash";
import { z } from "zod";
import { config } from "../config.js";
import { amadeusGet } from "../lib/amadeus.js";
import { buildUrl, fetchJsonCached, toApiError } from "../lib/http.js";
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

      return fetchJsonCached(url, {}, "Ticketmaster API request failed", CACHE_TTL.eventsMs);
    });
  });

  app.get("/api/holidays/public", async (req, res) => {
    await withRoute(res, async () => {
      const { year, countryCode } = validateQuery(req, holidaysSchema);
      const url = `${config.nagerBaseUrl}/PublicHolidays/${year}/${countryCode}`;
      return fetchJsonCached(url, {}, "Nager public holidays request failed", CACHE_TTL.holidaysMs);
    });
  });

  app.get("/api/holidays/long-weekends", async (req, res) => {
    await withRoute(res, async () => {
      const { year, countryCode } = validateQuery(req, holidaysSchema);
      const url = `${config.nagerBaseUrl}/LongWeekend/${year}/${countryCode}`;
      return fetchJsonCached(url, {}, "Nager long weekend request failed", CACHE_TTL.holidaysMs);
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
}
