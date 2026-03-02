import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.AMADEUS_API_KEY = process.env.AMADEUS_API_KEY ?? "test-amadeus-key";
process.env.AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET ?? "test-amadeus-secret";
process.env.TICKETMASTER_CONSUMER_KEY = process.env.TICKETMASTER_CONSUMER_KEY ?? "test-ticketmaster-key";
process.env.OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "test-openweather-key";
process.env.RATE_LIMIT_ENABLED = "false";

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
});
