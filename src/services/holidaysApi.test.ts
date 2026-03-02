import { afterEach, describe, expect, it, vi } from "vitest";
import { getLongWeekends, getPublicHolidays } from "./holidaysApi";

describe("holidaysApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array when public holidays payload is not an array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("null", {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await getPublicHolidays(2026, "AE");
    expect(result).toEqual([]);
  });

  it("returns empty array when long weekends payload is not an array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ invalid: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await getLongWeekends(2026, "AE");
    expect(result).toEqual([]);
  });
});
