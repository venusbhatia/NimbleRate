import { describe, expect, it } from "vitest";
import { normalizeLongWeekendEntries, normalizePublicHolidayEntries } from "./useDashboardData";

describe("useDashboardData normalization", () => {
  it("filters null and malformed public holiday records safely", () => {
    const normalized = normalizePublicHolidayEntries([
      null,
      { date: "2026-01-01", name: "New Year", localName: "New Year", countryCode: "US", types: ["Public"] },
      { invalid: true },
      { date: 1234 }
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.date).toBe("2026-01-01");
    expect(normalized[0]?.types).toEqual(["Public"]);
  });

  it("filters malformed long weekend records safely", () => {
    const normalized = normalizeLongWeekendEntries([
      null,
      { startDate: "2026-12-24", endDate: "2026-12-27", dayCount: 4, needBridgeDay: false },
      { startDate: "2026-05-01" },
      { endDate: "2026-05-02" }
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.startDate).toBe("2026-12-24");
    expect(normalized[0]?.endDate).toBe("2026-12-27");
  });
});
