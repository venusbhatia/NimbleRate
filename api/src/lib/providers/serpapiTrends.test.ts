import { describe, expect, it } from "vitest";
import { normalizeTrendsSignal, normalizeTrendsValues } from "./serpapiTrends.js";

describe("serpapiTrends", () => {
  it("extracts timeline values from SerpAPI payload", () => {
    const values = normalizeTrendsValues({
      interest_over_time: {
        timeline_data: [
          { values: [{ extracted_value: 55 }] },
          { values: [{ extracted_value: 62 }] },
          { values: [{ value: "71" }] }
        ]
      }
    });

    expect(values).toEqual([55, 62, 71]);
  });

  it("normalizes trends signal and computes multiplier", () => {
    const signal = normalizeTrendsSignal({
      interest_over_time: {
        timeline_data: Array.from({ length: 40 }).map((_, idx) => ({
          values: [{ extracted_value: idx < 33 ? 50 : 70 }]
        }))
      }
    });

    expect(signal.source).toBe("serpapi");
    expect(signal.searchMomentumIndex).toBeGreaterThan(50);
    expect(signal.searchDemandMultiplier).toBeGreaterThanOrEqual(1.07);
  });

  it("returns neutral fallback when payload is malformed", () => {
    const signal = normalizeTrendsSignal({ invalid: true });

    expect(signal.source).toBe("fallback");
    expect(signal.searchDemandMultiplier).toBe(1);
    expect(signal.searchMomentumIndex).toBe(50);
  });
});
