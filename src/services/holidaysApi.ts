import type { LongWeekend, PublicHoliday } from "../types/holidays";
import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function getPublicHolidays(year: number, countryCode: string) {
  const response = await apiFetch<unknown>(apiPath("/api/holidays/public"), {
    params: {
      year,
      countryCode
    }
  });

  return toArray<PublicHoliday>(response);
}

export async function getLongWeekends(year: number, countryCode: string) {
  const response = await apiFetch<unknown>(apiPath("/api/holidays/long-weekends"), {
    params: {
      year,
      countryCode
    }
  });

  return toArray<LongWeekend>(response);
}

export async function getAvailableCountries() {
  return apiFetch<Array<{ countryCode: string; name: string }>>(apiPath("/api/holidays/countries"));
}
