import { beforeEach, describe, expect, it } from "vitest";
import { executeSql } from "./db.js";
import {
  assertProviderBudget,
  getProviderUsage,
  getUsageSummary,
  incrementProviderUsage
} from "./usageBudget.js";

describe("usageBudget", () => {
  beforeEach(() => {
    executeSql("DELETE FROM provider_usage;");
  });

  it("tracks provider usage and threshold transitions", () => {
    incrementProviderUsage("makcorps", 20);
    const warning = getProviderUsage("makcorps");
    expect(warning.status).toBe("warning");
    expect(warning.remaining).toBeGreaterThanOrEqual(0);

    incrementProviderUsage("makcorps", 4);
    const critical = getProviderUsage("makcorps");
    expect(critical.status).toBe("critical");
    expect(() => assertProviderBudget("makcorps")).toThrowError();
  });

  it("returns aggregate summary", () => {
    incrementProviderUsage("predicthq", 10);
    incrementProviderUsage("serpapi", 5);
    incrementProviderUsage("amadeus_flights", 2);
    const summary = getUsageSummary();
    expect(summary.providers).toHaveLength(4);
    expect(summary.providers.some((provider) => provider.provider === "predicthq")).toBe(true);
    expect(summary.providers.some((provider) => provider.provider === "serpapi")).toBe(true);
    expect(summary.providers.some((provider) => provider.provider === "amadeus_flights")).toBe(true);
    expect(summary.providers.every((provider) => provider.provider !== "cloudbeds")).toBe(true);
    expect(summary.providers.every((provider) => provider.provider !== "airdna")).toBe(true);
  });
});
