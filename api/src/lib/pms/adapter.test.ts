import { describe, expect, it, vi } from "vitest";

const baseRequest = {
  cityName: "Austin",
  checkInDate: "2026-03-10",
  daysForward: 14,
  hotelType: "city" as const,
  totalRooms: 40
};

describe("pms adapter resolver", () => {
  it("uses simulated mode when PMS_PROVIDER=simulated", async () => {
    process.env.AMADEUS_API_KEY = process.env.AMADEUS_API_KEY ?? "test-amadeus-key";
    process.env.AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET ?? "test-amadeus-secret";
    process.env.TICKETMASTER_CONSUMER_KEY = process.env.TICKETMASTER_CONSUMER_KEY ?? "test-ticketmaster-key";
    process.env.OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "test-openweather-key";
    process.env.PMS_PROVIDER = "simulated";
    process.env.CLOUDBEDS_API_KEY = "";
    process.env.CLOUDBEDS_PROPERTY_ID = "";
    vi.resetModules();

    const { resolvePmsPace } = await import("./adapter.js");
    const result = await resolvePmsPace(baseRequest);

    expect(result.modeUsed).toBe("simulated");
    expect(result.fallbackUsed).toBe(false);
    expect(result.fallbackFlag).toBeNull();
    expect(result.pace.length).toBe(14);
  });

  it("falls back to simulated mode when cloudbeds is selected without credentials", async () => {
    process.env.AMADEUS_API_KEY = process.env.AMADEUS_API_KEY ?? "test-amadeus-key";
    process.env.AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET ?? "test-amadeus-secret";
    process.env.TICKETMASTER_CONSUMER_KEY = process.env.TICKETMASTER_CONSUMER_KEY ?? "test-ticketmaster-key";
    process.env.OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "test-openweather-key";
    process.env.PMS_PROVIDER = "cloudbeds";
    process.env.CLOUDBEDS_API_KEY = "";
    process.env.CLOUDBEDS_PROPERTY_ID = "";
    vi.resetModules();

    const { resolvePmsPace } = await import("./adapter.js");
    const result = await resolvePmsPace(baseRequest);

    expect(result.selectedProvider).toBe("cloudbeds");
    expect(result.modeUsed).toBe("simulated");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackFlag).toBe("pms_fallback_simulated");
    expect(result.pace.length).toBe(14);
  });
});
