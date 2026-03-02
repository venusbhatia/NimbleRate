import { addDays, format } from "date-fns";
import { describe, expect, it } from "vitest";
import { calculateV2Recommendations, summarizeRates, type EngineSignalInput } from "./priceEngineV2.js";

function makeSignals(days: number): EngineSignalInput[] {
  return Array.from({ length: days }).map((_, idx) => ({
    date: format(addDays(new Date(), idx + 1), "yyyy-MM-dd"),
    weatherCategory: "cloudy",
    eventImpactScore: idx === 0 ? 65 : 20,
    isHoliday: idx === 2,
    isLongWeekend: false,
    pace: {
      date: format(addDays(new Date(), idx + 1), "yyyy-MM-dd"),
      roomsBooked: 24,
      roomsAvailable: 16,
      occupancyRate: 60,
      pickupLast7Days: 3,
      occupancyLastYear: 55
    }
  }));
}

describe("priceEngineV2", () => {
  it("anchors recommendation from compset percentiles", () => {
    const output = calculateV2Recommendations({
      compsetRates: [120, 140, 160, 180, 200],
      targetMarketPosition: 0.5,
      minPrice: 80,
      maxPrice: 400,
      hotelType: "city",
      signals: makeSignals(7)
    });

    expect(output.compsetMedian).toBe(160);
    expect(output.anchorRate).toBeGreaterThanOrEqual(output.compsetP25);
    expect(output.anchorRate).toBeLessThanOrEqual(output.compsetP75);
    expect(output.recommendations).toHaveLength(7);
  });

  it("respects min/max guardrails and daily-change cap", () => {
    const output = calculateV2Recommendations({
      compsetRates: [100, 150, 200, 250, 300],
      targetMarketPosition: 1,
      minPrice: 140,
      maxPrice: 220,
      hotelType: "beach",
      signals: makeSignals(10)
    });

    output.recommendations.forEach((row) => {
      expect(row.finalRate).toBeGreaterThanOrEqual(140);
      expect(row.finalRate).toBeLessThanOrEqual(220);
    });

    for (let i = 1; i < output.recommendations.length; i += 1) {
      const prev = output.recommendations[i - 1].finalRate;
      const current = output.recommendations[i].finalRate;
      expect(Math.abs(current - prev)).toBeLessThanOrEqual(Math.ceil(prev * 0.2));
    }
  });

  it("summarizes rate collections", () => {
    const summary = summarizeRates([100, 120, 140, 160]);
    expect(summary.sampleSize).toBe(4);
    expect(summary.medianRate).toBe(130);
    expect(summary.averageRate).toBe(130);
  });
});
