import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type { UsageSummaryResponse } from "../types/usage";

export function getProviderUsageSummary() {
  return apiFetch<UsageSummaryResponse>(apiPath("/api/usage/summary"));
}
