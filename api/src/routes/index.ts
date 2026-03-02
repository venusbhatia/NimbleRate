import type { Express, Response } from "express";
import ngeohash from "ngeohash";
import { config } from "../config.js";
import { amadeusGet } from "../lib/amadeus.js";
import { buildUrl, fetchJson, RequestValidationError, toApiError } from "../lib/http.js";
import { optionalBoolean, optionalNumber, optionalString, requireString } from "../lib/validation.js";

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
      const cityCode = requireString(req, "cityCode");
      return amadeusGet("/v1/reference-data/locations/hotels/by-city", {
        cityCode,
        radius: optionalNumber(req, "radius"),
        radiusUnit: optionalString(req, "radiusUnit"),
        amenities: optionalString(req, "amenities"),
        ratings: optionalString(req, "ratings"),
        hotelSource: optionalString(req, "hotelSource")
      });
    });
  });

  app.get("/api/hotels/by-geocode", async (req, res) => {
    await withRoute(res, async () => {
      const latitude = requireString(req, "latitude");
      const longitude = requireString(req, "longitude");
      return amadeusGet("/v1/reference-data/locations/hotels/by-geocode", {
        latitude,
        longitude,
        radius: optionalNumber(req, "radius"),
        radiusUnit: optionalString(req, "radiusUnit"),
        amenities: optionalString(req, "amenities"),
        ratings: optionalString(req, "ratings"),
        hotelSource: optionalString(req, "hotelSource")
      });
    });
  });

  app.get("/api/hotels/offers", async (req, res) => {
    await withRoute(res, async () => {
      const hotelIds = requireString(req, "hotelIds");
      const adults = optionalNumber(req, "adults") ?? 2;
      const checkInDate = requireString(req, "checkInDate");
      const checkOutDate = requireString(req, "checkOutDate");

      return amadeusGet("/v3/shopping/hotel-offers", {
        hotelIds,
        adults,
        checkInDate,
        checkOutDate,
        roomQuantity: optionalNumber(req, "roomQuantity"),
        currency: optionalString(req, "currency"),
        priceRange: optionalString(req, "priceRange"),
        boardType: optionalString(req, "boardType"),
        bestRateOnly: optionalBoolean(req, "bestRateOnly")
      });
    });
  });

  app.get("/api/hotels/offers/:offerId", async (req, res) => {
    await withRoute(res, async () => amadeusGet(`/v3/shopping/hotel-offers/${req.params.offerId}`, {}));
  });

  app.get("/api/hotels/sentiments", async (req, res) => {
    await withRoute(res, async () => {
      const hotelIds = requireString(req, "hotelIds");
      return amadeusGet("/v2/e-reputation/hotel-sentiments", { hotelIds });
    });
  });

  app.get("/api/hotels/autocomplete", async (req, res) => {
    await withRoute(res, async () => {
      const keyword = requireString(req, "keyword");
      return amadeusGet("/v1/reference-data/locations/hotel", {
        keyword,
        subType: "HOTEL_LEISURE"
      });
    });
  });

  app.get("/api/events", async (req, res) => {
    await withRoute(res, async () => {
      const latitude = optionalNumber(req, "latitude");
      const longitude = optionalNumber(req, "longitude");
      const geoPoint = optionalString(req, "geoPoint");

      if ((latitude === undefined || longitude === undefined) && !geoPoint) {
        throw new RequestValidationError("Provide latitude/longitude or geoPoint");
      }

      const resolvedGeoPoint = geoPoint ?? ngeohash.encode(latitude!, longitude!, 7);
      const url = buildUrl("https://app.ticketmaster.com/discovery/v2", "/events.json", {
        apikey: config.ticketmasterApiKey,
        geoPoint: resolvedGeoPoint,
        latlong: latitude !== undefined && longitude !== undefined ? `${latitude},${longitude}` : undefined,
        radius: optionalNumber(req, "radius") ?? 25,
        unit: optionalString(req, "unit") ?? "miles",
        startDateTime: optionalString(req, "startDateTime"),
        endDateTime: optionalString(req, "endDateTime"),
        sort: optionalString(req, "sort") ?? "date,asc",
        size: optionalNumber(req, "size") ?? 50,
        page: optionalNumber(req, "page") ?? 0,
        classificationName: optionalString(req, "classificationName")
      });

      return fetchJson(url, {}, "Ticketmaster API request failed");
    });
  });

  app.get("/api/holidays/public", async (req, res) => {
    await withRoute(res, async () => {
      const year = requireString(req, "year");
      const countryCode = requireString(req, "countryCode");
      const url = `${config.nagerBaseUrl}/PublicHolidays/${year}/${countryCode}`;
      return fetchJson(url, {}, "Nager public holidays request failed");
    });
  });

  app.get("/api/holidays/long-weekends", async (req, res) => {
    await withRoute(res, async () => {
      const year = requireString(req, "year");
      const countryCode = requireString(req, "countryCode");
      const url = `${config.nagerBaseUrl}/LongWeekend/${year}/${countryCode}`;
      return fetchJson(url, {}, "Nager long weekend request failed");
    });
  });

  app.get("/api/holidays/countries", async (_req, res) => {
    await withRoute(res, async () => {
      const url = `${config.nagerBaseUrl}/AvailableCountries`;
      return fetchJson(url, {}, "Nager available countries request failed");
    });
  });

  app.get("/api/weather/forecast", async (req, res) => {
    await withRoute(res, async () => {
      const latitude = requireString(req, "latitude");
      const longitude = requireString(req, "longitude");
      const url = buildUrl("https://api.openweathermap.org/data/2.5", "/forecast", {
        lat: latitude,
        lon: longitude,
        appid: config.openWeatherApiKey,
        units: optionalString(req, "units") ?? "metric"
      });

      return fetchJson(url, {}, "OpenWeather forecast request failed");
    });
  });

  app.get("/api/weather/geocode", async (req, res) => {
    await withRoute(res, async () => {
      const q = requireString(req, "q");
      const url = buildUrl("https://api.openweathermap.org/geo/1.0", "/direct", {
        q,
        limit: optionalNumber(req, "limit") ?? 5,
        appid: config.openWeatherApiKey
      });

      return fetchJson(url, {}, "OpenWeather geocode request failed");
    });
  });
}
