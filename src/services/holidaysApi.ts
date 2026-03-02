import type { LongWeekend, PublicHoliday } from "../types/holidays";
import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";

export async function getPublicHolidays(year: number, countryCode: string) {
  return apiFetch<PublicHoliday[]>(apiPath("/api/holidays/public"), {
    params: {
      year,
      countryCode
    }
  });
}

export async function getLongWeekends(year: number, countryCode: string) {
  return apiFetch<LongWeekend[]>(apiPath("/api/holidays/long-weekends"), {
    params: {
      year,
      countryCode
    }
  });
}

export async function getAvailableCountries() {
  return apiFetch<Array<{ countryCode: string; name: string }>>(apiPath("/api/holidays/countries"));
}
