export type ExternalProvider =
  | "makcorps"
  | "predicthq"
  | "serpapi"
  | "amadeus_flights";
export type ProviderUsageStatus = "ok" | "warning" | "critical";

export interface ProviderUsageSummary {
  provider: ExternalProvider;
  day: string;
  calls: number;
  quota: number;
  remaining: number;
  percentUsed: number;
  status: ProviderUsageStatus;
  recommendation: string;
}

export interface UsageSummaryResponse {
  day: string;
  providers: ProviderUsageSummary[];
  overallStatus: ProviderUsageStatus;
}
