import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";
import type {
  RatePushJobDetailsResponse,
  RatePushJobListResponse,
  RatePushRequest,
  RatePushResponse
} from "../types/operations";

export function createRatePushJob(payload: RatePushRequest) {
  return apiFetch<RatePushResponse>(apiPath("/api/rates/push"), {
    method: "POST",
    body: payload
  });
}

export function listRatePushJobs(params?: { propertyId?: string; limit?: number }) {
  return apiFetch<RatePushJobListResponse>(apiPath("/api/rates/push/jobs"), {
    params: params as unknown as Record<string, string | number | boolean | undefined>
  });
}

export function getRatePushJob(jobId: number) {
  return apiFetch<RatePushJobDetailsResponse>(apiPath(`/api/rates/push/jobs/${jobId}`));
}
