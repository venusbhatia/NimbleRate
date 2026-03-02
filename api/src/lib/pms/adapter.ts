import { config } from "../../config.js";
import { createSimulatedPmsAdapter } from "./simulatedAdapter.js";
import type { PmsAdapter, PmsPaceRequest, PmsProvider } from "./types.js";

export interface ResolvedPmsResult {
  selectedProvider: PmsProvider;
  modeUsed: "simulated" | "cloudbeds";
  fallbackUsed: boolean;
  fallbackFlag: "pms_fallback_simulated" | null;
  healthMessage: string;
  pmsSyncAt: string | null;
  pace: Awaited<ReturnType<PmsAdapter["getPace"]>>;
}

export async function resolvePmsPace(request: PmsPaceRequest): Promise<ResolvedPmsResult> {
  const simulated = createSimulatedPmsAdapter();
  const preferredProvider = config.pmsProvider;
  const simulatedPace = await simulated.getPace(request);

  if (preferredProvider === "simulated") {
    return {
      selectedProvider: "simulated",
      modeUsed: "simulated",
      fallbackUsed: false,
      fallbackFlag: null,
      healthMessage: "Using simulated PMS pace data.",
      pmsSyncAt: null,
      pace: simulatedPace
    };
  }

  return {
    selectedProvider: "cloudbeds",
    modeUsed: "simulated",
    fallbackUsed: true,
    fallbackFlag: "pms_fallback_simulated",
    healthMessage: "Cloudbeds live mode is disabled in this deployment; using simulated PMS pace.",
    pmsSyncAt: null,
    pace: simulatedPace
  };
}
