import { describe, expect, it } from "vitest";
import { getUniversityDemandSignal } from "./universityDemand.js";

describe("universityDemand", () => {
  it("returns dataset-based signal for known market dates", () => {
    const signal = getUniversityDemandSignal({
      cityName: "Austin",
      countryCode: "US",
      analysisDates: ["2026-05-19", "2026-05-20", "2026-05-21", "2026-05-22", "2026-05-23", "2026-05-24"]
    });

    expect(signal.source).toBe("dataset");
    expect(signal.marketKey).toBe("austin-us");
    expect(signal.campusDemandDays).toBeGreaterThan(0);
    expect(signal.campusDemandByDate["2026-05-20"]?.multiplier).toBeGreaterThan(1);
    expect(signal.campusDemandByDate["2026-05-20"]?.reasons.length).toBeGreaterThan(0);
  });

  it("returns neutral fallback for unknown market", () => {
    const signal = getUniversityDemandSignal({
      cityName: "Oslo",
      countryCode: "NO",
      analysisDates: ["2026-05-20", "2026-05-21"]
    });

    expect(signal.source).toBe("fallback");
    expect(signal.campusDemandDays).toBe(0);
    expect(signal.campusDemandByDate["2026-05-20"]?.multiplier).toBe(1);
    expect(signal.campusDemandByDate["2026-05-20"]?.score).toBe(0);
  });
});
