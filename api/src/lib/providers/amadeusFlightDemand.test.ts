import { describe, expect, it } from "vitest";
import { normalizeFlightDemandForFallback, resolveDestinationIata } from "./amadeusFlightDemand.js";

describe("amadeusFlightDemand", () => {
  it("prefers explicit cityCode when valid", () => {
    const iata = resolveDestinationIata({
      cityName: "Austin",
      countryCode: "US",
      cityCode: "AUS"
    });

    expect(iata).toBe("AUS");
  });

  it("falls back to city-country mapping when cityCode is missing", () => {
    const iata = resolveDestinationIata({
      cityName: "Austin",
      countryCode: "US"
    });

    expect(iata).toBe("AUS");
  });

  it("returns null for unknown market and neutral fallback signal", () => {
    const iata = resolveDestinationIata({
      cityName: "Unknown City",
      countryCode: "ZZ"
    });

    const fallback = normalizeFlightDemandForFallback();
    expect(iata).toBeNull();
    expect(fallback.source).toBe("fallback");
    expect(fallback.travelIntentMultiplier).toBe(1);
  });
});
