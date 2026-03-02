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
const { executeSql, sqlQuote } = await import("./lib/db.js");

const app = createApp();

describe("api routes", () => {
  beforeEach(() => {
    clearResponseCache();
    executeSql(`
      DELETE FROM provider_usage;
      DELETE FROM compset_snapshots;
      DELETE FROM analysis_runs;
      DELETE FROM analysis_daily;
      DELETE FROM rate_push_job_items;
      DELETE FROM rate_push_jobs;
      DELETE FROM properties WHERE property_id != 'default';
    `);
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

  it("returns ANALYSIS_REQUIRED for compset suggestions when no snapshots exist", async () => {
    const response = await request(app).get(
      "/api/compset/suggestions?cityName=Austin&countryCode=US&propertyId=default&latitude=30.2672&longitude=-97.7431"
    );

    expect(response.status).toBe(409);
    expect(response.body.details?.code).toBe("ANALYSIS_REQUIRED");
  });

  it("returns usage summary endpoint payload", async () => {
    const response = await request(app).get("/api/usage/summary");

    expect(response.status).toBe(200);
    expect(response.body.providers).toBeDefined();
    expect(Array.isArray(response.body.providers)).toBe(true);
    expect(response.body.providers).toHaveLength(4);
    expect(response.body.providers.some((provider: { provider: string }) => provider.provider === "makcorps")).toBe(true);
    expect(response.body.providers.some((provider: { provider: string }) => provider.provider === "predicthq")).toBe(true);
    expect(response.body.providers.some((provider: { provider: string }) => provider.provider === "serpapi")).toBe(true);
    expect(response.body.providers.some((provider: { provider: string }) => provider.provider === "amadeus_flights")).toBe(true);
  });

  it("returns default property and supports property create/update lifecycle", async () => {
    const listResponse = await request(app).get("/api/properties");
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.properties)).toBe(true);
    expect(listResponse.body.properties.some((property: { propertyId: string }) => property.propertyId === "default")).toBe(true);

    const createResponse = await request(app).post("/api/properties").send({
      propertyId: "demo-hotel",
      name: "Demo Hotel",
      countryCode: "US",
      cityName: "Austin",
      latitude: 30.2672,
      longitude: -97.7431,
      hotelType: "city",
      totalRooms: 55,
      channelProvider: "simulated"
    });
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.property.propertyId).toBe("demo-hotel");

    const patchResponse = await request(app).patch("/api/properties/demo-hotel").send({
      totalRooms: 63,
      name: "Demo Hotel Updated"
    });
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.property.totalRooms).toBe(63);
    expect(patchResponse.body.property.name).toBe("Demo Hotel Updated");
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
    expect(response.body.paceSource).toBe("simulated");
    expect(response.body.pmsSyncAt).toBeNull();
    expect(response.body.supplySource).toBe("fallback_proxy");
    expect(response.body.compsetSuggestionVersion === null || response.body.compsetSuggestionVersion === "v1").toBe(
      true
    );
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

  it("returns ANALYSIS_REQUIRED for market history when no historical runs exist", async () => {
    const response = await request(app).get("/api/market/history?cityName=Austin&countryCode=US&days=30");

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("No historical analysis runs");
    expect(response.body.details?.code).toBe("ANALYSIS_REQUIRED");
  });

  it("returns market history payload from persisted analysis runs", async () => {
    const now = new Date();
    const run1 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const run2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const run3 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const payload = JSON.stringify({ cityName: "Austin" });

    executeSql(`
      INSERT INTO analysis_runs(market_key, requested_at, confidence, anchor_rate, recommended_rate, payload_json)
      VALUES
        ('austin-us', ${sqlQuote(run1)}, 'medium', 200, 210, ${sqlQuote(payload)}),
        ('austin-us', ${sqlQuote(run2)}, 'high', 205, 220, ${sqlQuote(payload)}),
        ('austin-us', ${sqlQuote(run3)}, 'high', 208, 230, ${sqlQuote(payload)});

      INSERT INTO compset_snapshots(city, check_in, check_out, hotel_name, hotel_id, rate, ota, collected_at)
      VALUES
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel A', 'H1', 215, 'booking', ${sqlQuote(run2)}),
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel B', 'H2', 225, 'expedia', ${sqlQuote(run2)}),
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel C', 'H3', 235, 'agoda', ${sqlQuote(run3)});
    `);

    const response = await request(app).get("/api/market/history?cityName=Austin&countryCode=US&days=30");

    expect(response.status).toBe(200);
    expect(response.body.marketKey).toBe("austin-us");
    expect(response.body.windowDays).toBe(30);
    expect(Array.isArray(response.body.daily)).toBe(true);
    expect(response.body.daily.length).toBeGreaterThanOrEqual(2);
    expect(response.body.summary.recommendedAvg).toBeGreaterThan(0);
    expect(response.body.summary.volatilityPct).toBeGreaterThanOrEqual(0);
  });

  it("returns ANALYSIS_REQUIRED for parity summary when no snapshot exists", async () => {
    const response = await request(app).get(
      "/api/parity/summary?cityName=Austin&countryCode=US&checkInDate=2026-03-10&checkOutDate=2026-03-12&directRate=229"
    );

    expect(response.status).toBe(409);
    expect(response.body.message).toContain("No compset snapshot");
    expect(response.body.details?.code).toBe("ANALYSIS_REQUIRED");
  });

  it("returns parity summary payload with risk and alerts", async () => {
    const snapshotAt = new Date().toISOString();
    executeSql(`
      INSERT INTO compset_snapshots(city, check_in, check_out, hotel_name, hotel_id, rate, ota, collected_at)
      VALUES
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel A', 'H1', 180, 'booking', ${sqlQuote(snapshotAt)}),
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel B', 'H2', 210, 'expedia', ${sqlQuote(snapshotAt)}),
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel C', 'H3', 235, 'agoda', ${sqlQuote(snapshotAt)}),
        ('Austin', '2026-03-10', '2026-03-12', 'Hotel D', 'H4', 260, 'hotels', ${sqlQuote(snapshotAt)});
    `);

    const response = await request(app).get(
      "/api/parity/summary?cityName=Austin&countryCode=US&checkInDate=2026-03-10&checkOutDate=2026-03-12&directRate=229&tolerancePct=2"
    );

    expect(response.status).toBe(200);
    expect(response.body.marketKey).toBe("austin-us");
    expect(response.body.summary.undercutCount).toBeGreaterThan(0);
    expect(response.body.summary.parityCount).toBeGreaterThanOrEqual(0);
    expect(response.body.summary.overcutCount).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(response.body.summary.riskLevel);
    expect(Array.isArray(response.body.alerts)).toBe(true);
  });

  it("returns pms health payload", async () => {
    const response = await request(app).get("/api/pms/health");

    expect(response.status).toBe(200);
    expect(response.body.selectedProvider).toBe("simulated");
    expect(response.body.activeMode).toBe("simulated");
    expect(Array.isArray(response.body.providers)).toBe(true);
    expect(response.body.providers.some((provider: { provider: string }) => provider.provider === "cloudbeds")).toBe(true);
  });

  it("returns supply fallback when no compset snapshot history exists", async () => {
    const response = await request(app).get("/api/supply/str?cityName=Austin&countryCode=US&propertyId=default");

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("fallback_proxy");
    expect(response.body.status).toBe("neutral_fallback");
    expect(response.body.supplyPressureIndex).toBe(50);
    expect(response.body.warning).toContain("AirDNA is deferred");
  });

  it("creates dry-run rate push jobs and returns job details", async () => {
    const createResponse = await request(app).post("/api/rates/push").send({
      propertyId: "default",
      marketKey: "austin-us",
      mode: "dry_run",
      manualApproval: false,
      rates: [
        { date: "2026-03-10", rate: 229, currency: "USD" },
        { date: "2026-03-11", rate: 239, currency: "USD" }
      ]
    });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.jobId).toBeGreaterThan(0);
    expect(createResponse.body.mode).toBe("dry_run");

    const detailsResponse = await request(app).get(`/api/rates/push/jobs/${createResponse.body.jobId}`);
    expect(detailsResponse.status).toBe(200);
    expect(detailsResponse.body.job.mode).toBe("dry_run");
    expect(detailsResponse.body.items.length).toBe(2);
  });

  it("returns same job for duplicate idempotent dry-run rate push request", async () => {
    const payload = {
      propertyId: "default",
      marketKey: "austin-us",
      mode: "dry_run",
      manualApproval: false,
      idempotencyKey: "test-idempotency-key",
      rates: [{ date: "2026-03-10", rate: 229, currency: "USD" }]
    };

    const first = await request(app).post("/api/rates/push").send(payload);
    const second = await request(app).post("/api/rates/push").send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.jobId).toBe(first.body.jobId);
  });

  it("blocks publish and rollback modes when live publisher is disabled", async () => {
    const response = await request(app).post("/api/rates/push").send({
      propertyId: "default",
      marketKey: "austin-us",
      mode: "publish",
      manualApproval: true,
      rates: [{ date: "2026-03-10", rate: 229, currency: "USD" }]
    });

    expect(response.status).toBe(409);
    expect(response.body.details?.code).toBe("PUBLISH_PROVIDER_DISABLED");

    const rollbackResponse = await request(app).post("/api/rates/push").send({
      propertyId: "default",
      marketKey: "austin-us",
      mode: "rollback",
      manualApproval: true,
      rates: [{ date: "2026-03-10", rate: 229, currency: "USD" }]
    });

    expect(rollbackResponse.status).toBe(409);
    expect(rollbackResponse.body.details?.code).toBe("PUBLISH_PROVIDER_DISABLED");
  });

  it("returns rate push jobs list", async () => {
    await request(app).post("/api/rates/push").send({
      propertyId: "default",
      marketKey: "austin-us",
      mode: "dry_run",
      manualApproval: false,
      rates: [{ date: "2026-03-10", rate: 229, currency: "USD" }]
    });

    const response = await request(app).get("/api/rates/push/jobs?propertyId=default&limit=10");
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.jobs)).toBe(true);
    expect(response.body.jobs.length).toBeGreaterThan(0);
  });

  it("returns ANALYSIS_REQUIRED for revenue analytics when no analysis history exists", async () => {
    const response = await request(app).get(
      "/api/revenue/analytics?cityName=Austin&countryCode=US&propertyId=default&days=30"
    );

    expect(response.status).toBe(409);
    expect(response.body.details?.code).toBe("ANALYSIS_REQUIRED");
  });

  it("returns ANALYSIS_REQUIRED for pace anomalies when no analysis history exists", async () => {
    const response = await request(app).get(
      "/api/pace/anomalies?cityName=Austin&countryCode=US&propertyId=default&days=45"
    );

    expect(response.status).toBe(409);
    expect(response.body.details?.code).toBe("ANALYSIS_REQUIRED");
  });
});
