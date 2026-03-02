import { generatePaceSimulation } from "../paceSimulator.js";
import type { PmsAdapter } from "./types.js";

export function createSimulatedPmsAdapter(): PmsAdapter {
  return {
    provider: "simulated",
    async getPace(request) {
      return generatePaceSimulation({
        totalRooms: request.totalRooms,
        daysForward: request.daysForward,
        hotelType: request.hotelType,
        seed: request.seed ?? `${request.cityName}-${request.checkInDate}`,
        startDate: request.checkInDate
      });
    },
    async health() {
      return {
        provider: "simulated",
        configured: true,
        message: "Using simulated PMS pace data."
      };
    }
  };
}
