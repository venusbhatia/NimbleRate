import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.AMADEUS_API_KEY = process.env.AMADEUS_API_KEY ?? "test-amadeus-key";
process.env.AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET ?? "test-amadeus-secret";
process.env.TICKETMASTER_CONSUMER_KEY = process.env.TICKETMASTER_CONSUMER_KEY ?? "test-ticketmaster-key";
process.env.OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "test-openweather-key";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.MAKCORPS_API_KEY = "";
process.env.MAKCORPS_USERNAME = "";
process.env.MAKCORPS_PASSWORD = "";

const { createApp } = await import("./app.js");
const { clearResponseCache } = await import("./lib/http.js");

const app = createApp();

describe("api routes", () => {
  beforeEach(() => {
    clearResponseCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns health status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "nimblerate-api" });
  });

  it("validates required params for events endpoint", async () => {
    const response = await request(app).get("/api/events");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Provide latitude/longitude or geoPoint");
  });

  it("caches upstream country responses", async () => {
    const payload = [{ countryCode: "US", name: "United States" }];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const first = await request(app).get("/api/holidays/countries");
    const second = await request(app).get("/api/holidays/countries");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body).toEqual(payload);
    expect(second.body).toEqual(payload);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns validation error when cityCode is missing", async () => {
    const response = await request(app).get("/api/hotels/by-city");

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("cityCode");
  });

  it("normalizes null public holidays payload to an empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("null", {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const response = await request(app).get("/api/holidays/public?year=2026&countryCode=AE");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("normalizes non-array long weekend payload to an empty array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const response = await request(app).get("/api/holidays/long-weekends?year=2026&countryCode=AE");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns not-configured response for Makcorps compset routes when credentials are missing", async () => {
    const response = await request(app).get(
      "/api/compset/search?city=Austin&checkInDate=2026-03-10&checkOutDate=2026-03-12"
    );

    expect(response.status).toBe(503);
    expect(response.body.message).toContain("Makcorps provider not configured");
    expect(response.body.details?.code).toBe("NOT_CONFIGURED");
  });

  it("returns usage summary endpoint payload", async () => {
    const response = await request(app).get("/api/usage/summary");

    expect(response.status).toBe(200);
    expect(response.body.providers).toBeDefined();
    expect(Array.isArray(response.body.providers)).toBe(true);
  });

  it("returns Makcorps diagnostics payload even when provider is not configured", async () => {
    const response = await request(app).get(
      "/api/providers/makcorps/diagnostics?city=Austin&checkInDate=2026-03-10&checkOutDate=2026-03-12"
    );

    expect(response.status).toBe(200);
    expect(response.body.configured).toBe(false);
    expect(Array.isArray(response.body.attempts)).toBe(true);
    expect(response.body.recommendedMode).toBe("none");
  });

  it("returns market analysis payload with degraded fallbacks when providers are unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/PublicHolidays/")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/LongWeekend/")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("openweathermap.org/data/2.5/forecast")) {
        return new Response(
          JSON.stringify({
            list: [
              {
                dt_txt: "2026-03-10 12:00:00",
                main: { temp: 22, humidity: 45 },
                pop: 0.1,
                weather: [{ id: 800, icon: "01d" }]
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: "upstream unavailable in test" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    });

    const response = await request(app).get(
      "/api/market/analysis?cityName=Austin&countryCode=US&latitude=30.2672&longitude=-97.7431&checkInDate=2026-03-10&checkOutDate=2026-03-12&hotelType=city&estimatedOccupancy=68&adults=2"
    );

    expect(response.status).toBe(200);
    expect(response.body.model).toBeDefined();
    expect(response.body.model.marketAnchor).toBeDefined();
    expect(Array.isArray(response.body.model.pricing)).toBe(true);
    expect(Array.isArray(response.body.warnings)).toBe(true);
    expect(response.body.analysisContext?.cityName).toBe("Austin");
    expect(response.body.analysisContext?.runMode).toBe("fallback_first");
    expect(response.body.analysisContext?.phase).toBe("phase2_wave1");
    expect(response.body.analysisContext?.pmsMode).toBe("simulated");
    expect(Array.isArray(response.body.fallbacksUsed)).toBe(true);
    expect(response.body.fallbacksUsed).toContain("compset_fallback_static");
    expect(response.body.fallbacksUsed).toContain("trends_fallback_neutral");
    expect(response.body.fallbacksUsed).toContain("flight_demand_fallback_neutral");
    expect(response.body.explainabilityByDate).toBeDefined();
    const firstDate = response.body.model.pricing[0]?.date;
    expect(firstDate).toBeTruthy();
    expect(response.body.explainabilityByDate[firstDate]).toBeDefined();
    expect(response.body.explainabilityByDate[firstDate].guardrails).toBeDefined();
    expect(response.body.explainabilityByDate[firstDate].factors.searchDemand).toBeDefined();
    expect(response.body.explainabilityByDate[firstDate].factors.travelIntent).toBeDefined();
    expect(response.body.explainabilityByDate[firstDate].factors.campusDemand).toBeDefined();
    expect(response.body.model.insights.signals.searchMomentumIndex).toBeTypeOf("number");
    expect(response.body.model.insights.signals.flightDemandIndex).toBeTypeOf("number");
    expect(response.body.model.insights.signals.campusDemandDays).toBeTypeOf("number");
    expect(Array.isArray(response.body.sourceHealth)).toBe(true);
    expect(response.body.sourceHealth.some((row: { source: string; status: string }) => row.source === "Hotels")).toBe(true);
    expect(response.body.sourceHealth.some((row: { source: string; status: string }) => row.source === "Trends")).toBe(true);
    expect(response.body.sourceHealth.some((row: { source: string; status: string }) => row.source === "Flights")).toBe(true);
    expect(response.body.sourceHealth.some((row: { source: string; status: string }) => row.source === "PMS")).toBe(true);
    expect(response.body.sourceHealth.some((row: { source: string; status: string }) => row.source === "University")).toBe(true);
  });

  it("sets explicit events fallback flag when Ticketmaster fallback succeeds", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/PublicHolidays/") || url.includes("/LongWeekend/")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("openweathermap.org/data/2.5/forecast")) {
        return new Response(
          JSON.stringify({
            list: [
              {
                dt_txt: "2026-03-10 12:00:00",
                main: { temp: 20, humidity: 50 },
                pop: 0.1,
                weather: [{ id: 801, icon: "02d" }]
              }
            ]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      if (url.includes("ticketmaster.com/discovery/v2/events.json")) {
        return new Response(
          JSON.stringify({
            _embedded: {
              events: [
                {
                  id: "tm-1",
                  name: "Fallback Event",
                  dates: {
                    start: { localDate: "2026-03-10" },
                    status: { code: "onsale" }
                  },
                  _embedded: {
                    venues: [{ name: "Venue", location: { latitude: "30.26", longitude: "-97.74" } }]
                  },
                  classifications: [{ segment: { name: "Music" }, genre: { name: "Rock" } }]
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return new Response(JSON.stringify({ message: "upstream unavailable in test" }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    });

    const response = await request(app).get(
      "/api/market/analysis?cityName=Austin&countryCode=US&latitude=30.2672&longitude=-97.7431&checkInDate=2026-03-10&checkOutDate=2026-03-12&hotelType=city&estimatedOccupancy=68&adults=2"
    );

    expect(response.status).toBe(200);
    expect(response.body.fallbacksUsed).toContain("predicthq_fallback_ticketmaster");
  });
});
