import { config } from "../../config.js";
import { createCloudbedsAdapter } from "./cloudbedsAdapter.js";
import { createSimulatedPmsAdapter } from "./simulatedAdapter.js";
import type { PmsAdapter, PmsPaceRequest, PmsProvider } from "./types.js";

export interface ResolvedPmsResult {
  selectedProvider: PmsProvider;
  modeUsed: "simulated" | "cloudbeds";
  fallbackUsed: boolean;
  fallbackFlag: "pms_fallback_simulated" | null;
  healthMessage: string;
  pace: Awaited<ReturnType<PmsAdapter["getPace"]>>;
}

export async function resolvePmsPace(request: PmsPaceRequest): Promise<ResolvedPmsResult> {
  const simulated = createSimulatedPmsAdapter();
  const preferredProvider = config.pmsProvider;

  if (preferredProvider === "simulated") {
    return {
      selectedProvider: "simulated",
      modeUsed: "simulated",
      fallbackUsed: false,
      fallbackFlag: null,
      healthMessage: "Using simulated PMS pace data.",
      pace: await simulated.getPace(request)
    };
  }

  const cloudbeds = createCloudbedsAdapter();
  const cloudbedsHealth = await cloudbeds.health();

  if (!cloudbedsHealth.configured) {
    return {
      selectedProvider: "cloudbeds",
      modeUsed: "simulated",
      fallbackUsed: true,
      fallbackFlag: "pms_fallback_simulated",
      healthMessage: cloudbedsHealth.message,
      pace: await simulated.getPace(request)
    };
  }

  try {
    const pace = await cloudbeds.getPace(request);
    return {
      selectedProvider: "cloudbeds",
      modeUsed: "cloudbeds",
      fallbackUsed: false,
      fallbackFlag: null,
      healthMessage: cloudbedsHealth.message,
      pace
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cloudbeds adapter failed; using simulated fallback.";
    return {
      selectedProvider: "cloudbeds",
      modeUsed: "simulated",
      fallbackUsed: true,
      fallbackFlag: "pms_fallback_simulated",
      healthMessage: `${message} Using simulated fallback.`,
      pace: await simulated.getPace(request)
    };
  }
}
