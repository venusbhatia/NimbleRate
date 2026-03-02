import { describe, expect, it } from "vitest";
import {
  calculatePricingRecommendation,
  clampDailyRateChange,
  dampenedMultiplier,
  getOccupancyMultiplier,
  getWeatherMultiplier
} from "./priceUtils";

describe("priceUtils", () => {
  it("keeps occupancy multiplier within configured bounds", () => {
    expect(getOccupancyMultiplier(0)).toBeGreaterThanOrEqual(0.75);
    expect(getOccupancyMultiplier(100)).toBeLessThanOrEqual(2);
  });

  it("dampens values above 2.5x", () => {
    const raw = 4;
    const dampened = dampenedMultiplier(raw);

    expect(dampened).toBeGreaterThan(2.5);
    expect(dampened).toBeLessThan(raw);
  });

  it("applies hotel-type weather effects", () => {
    const beachRain = getWeatherMultiplier("rain", "beach");
    const cityRain = getWeatherMultiplier("rain", "city");

    expect(beachRain).toBeLessThan(cityRain);
  });

  it("caps final multiplier by tier", () => {
    const recommendation = calculatePricingRecommendation({
      date: "2026-07-04",
      baseRate: 200,
      occupancyRate: 100,
      hotelType: "beach",
      eventIntensity: 3,
      weatherCategory: "sunny",
      isHoliday: true,
      isLongWeekend: true,
      daysUntilCheckIn: 1,
      tier: "budget"
    });

    expect(recommendation.finalMultiplier).toBeLessThanOrEqual(2.5);
    expect(recommendation.finalRate).toBeGreaterThan(200);
  });

  it("limits daily rate changes", () => {
    expect(clampDailyRateChange(200, 300, 0.2)).toBe(240);
    expect(clampDailyRateChange(200, 120, 0.2)).toBe(160);
  });
});
