export interface ApiErrorShape {
  message: string;
  status: number;
  details?: unknown;
}

export type ExternalProvider =
  | "makcorps"
  | "predicthq"
  | "serpapi"
  | "amadeus_flights"
  | "cloudbeds"
  | "airdna";

export type ActiveUsageProvider = "makcorps" | "predicthq" | "serpapi" | "amadeus_flights";

export interface ProviderUsageRow {
  provider: ExternalProvider;
  day: string;
  calls: number;
  quota: number;
}

export interface ProviderUsageSummary extends ProviderUsageRow {
  remaining: number;
  percentUsed: number;
  status: "ok" | "warning" | "critical";
  recommendation: string;
}
