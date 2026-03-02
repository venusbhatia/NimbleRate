import { describe, expect, it } from "vitest";
import { computeQuotaState, fallbackLabel, quotaTone } from "./dashboardStatus";

describe("dashboardStatus", () => {
  it("returns blocked when no remaining budget is left", () => {
    const state = computeQuotaState({
      provider: "makcorps",
      day: "2026-03-02",
      calls: 25,
      quota: 25,
      remaining: 0,
      percentUsed: 100,
      status: "critical",
      recommendation: "rotate"
    });

    expect(state).toBe("blocked");
    expect(quotaTone(state)).toBe("negative");
  });

  it("maps fallback labels for known fallbacks", () => {
    expect(fallbackLabel("makcorps_fallback_amadeus")).toBe("Makcorps -> Amadeus fallback");
    expect(fallbackLabel("predicthq_fallback_ticketmaster")).toBe("PredictHQ -> Ticketmaster fallback");
    expect(fallbackLabel("compset_fallback_static")).toBe("Static compset fallback");
    expect(fallbackLabel("trends_fallback_neutral")).toBe("Trends -> neutral fallback");
    expect(fallbackLabel("flight_demand_fallback_neutral")).toBe("Flights -> neutral fallback");
    expect(fallbackLabel("pms_fallback_simulated")).toBe("PMS -> simulated fallback");
    expect(fallbackLabel("university_fallback_none")).toBe("University -> neutral fallback");
    expect(fallbackLabel("unknown_code")).toBe("unknown_code");
  });
});
