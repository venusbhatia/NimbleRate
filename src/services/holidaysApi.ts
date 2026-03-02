import type { LongWeekend, PublicHoliday } from "../types/holidays";
import { apiFetch } from "./apiClient";

const NAGER_BASE_URL = "https://date.nager.at/api/v3";

export async function getPublicHolidays(year: number, countryCode: string) {
  return apiFetch<PublicHoliday[]>(`${NAGER_BASE_URL}/PublicHolidays/${year}/${countryCode}`);
}

export async function getLongWeekends(year: number, countryCode: string) {
  return apiFetch<LongWeekend[]>(`${NAGER_BASE_URL}/LongWeekend/${year}/${countryCode}`);
}

export async function getAvailableCountries() {
  return apiFetch<Array<{ countryCode: string; name: string }>>(`${NAGER_BASE_URL}/AvailableCountries`);
}
