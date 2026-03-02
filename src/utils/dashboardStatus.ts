import type { ProviderUsageSummary } from "../types/usage";

export type QuotaState = "ok" | "warning" | "critical" | "blocked";

export function computeQuotaState(row: ProviderUsageSummary): QuotaState {
  if (row.remaining <= 0) {
    return "blocked";
  }
  return row.status;
}

export function quotaTone(state: QuotaState): "positive" | "gold" | "negative" {
  if (state === "ok") return "positive";
  if (state === "warning") return "gold";
  return "negative";
}

export function fallbackLabel(code: string) {
  switch (code) {
    case "makcorps_fallback_amadeus":
      return "Makcorps -> Amadeus fallback";
    case "predicthq_fallback_ticketmaster":
      return "PredictHQ -> Ticketmaster fallback";
    case "compset_fallback_static":
      return "Static compset fallback";
    case "trends_fallback_neutral":
      return "Trends -> neutral fallback";
    case "flight_demand_fallback_neutral":
      return "Flights -> neutral fallback";
    case "pms_fallback_simulated":
      return "PMS -> simulated fallback";
    case "university_fallback_none":
      return "University -> neutral fallback";
    default:
      return code;
  }
}
