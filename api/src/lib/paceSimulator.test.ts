import { describe, expect, it } from "vitest";
import { generatePaceSimulation } from "./paceSimulator.js";

describe("paceSimulator", () => {
  it("is deterministic for the same seed and inputs", () => {
    const input = {
      totalRooms: 40,
      daysForward: 30,
      hotelType: "city" as const,
      seed: "nyc-demo-seed",
      startDate: "2026-03-15"
    };

    const first = generatePaceSimulation(input);
    const second = generatePaceSimulation(input);

    expect(first).toEqual(second);
    expect(first).toHaveLength(30);
  });

  it("keeps occupancy outputs in sane ranges", () => {
    const rows = generatePaceSimulation({
      totalRooms: 55,
      daysForward: 45,
      hotelType: "leisure",
      seed: "range-test"
    });

    expect(rows).toHaveLength(45);
    rows.forEach((row) => {
      expect(row.roomsBooked).toBeGreaterThanOrEqual(0);
      expect(row.roomsAvailable).toBeGreaterThanOrEqual(0);
      expect(row.occupancyRate).toBeGreaterThanOrEqual(0);
      expect(row.occupancyRate).toBeLessThanOrEqual(100);
    });
  });
});
