import { config } from "../../config.js";
import { UpstreamError } from "../http.js";
import type { PmsAdapter } from "./types.js";

export function createCloudbedsAdapter(): PmsAdapter {
  return {
    provider: "cloudbeds",
    async getPace() {
      throw new UpstreamError("Cloudbeds live PMS ingestion is not implemented in phase2_wave1", 501, {
        provider: "cloudbeds",
        code: "NOT_IMPLEMENTED"
      });
    },
    async health() {
      const configured = Boolean(config.cloudbedsApiKey && config.cloudbedsPropertyId);
      return {
        provider: "cloudbeds",
        configured,
        message: configured
          ? "Cloudbeds credentials detected; adapter scaffold ready."
          : "Cloudbeds credentials missing; using simulated PMS fallback."
      };
    }
  };
}
