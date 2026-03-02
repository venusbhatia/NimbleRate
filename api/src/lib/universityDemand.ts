import { readFileSync } from "node:fs";

export type UniversityImpact = "low" | "medium" | "high";

export interface UniversityEvent {
  name: string;
  startDate: string;
  endDate: string;
  impact: UniversityImpact;
}

interface UniversityMarket {
  marketKey: string;
  events: UniversityEvent[];
}

const UNIVERSITY_DATA_PATH = new URL("../data/universityCalendars.json", import.meta.url);
let cachedCalendars: UniversityMarket[] | null = null;

export interface UniversityDemandSignal {
  marketKey: string;
  source: "dataset" | "fallback";
  campusDemandDays: number;
  campusDemandByDate: Record<string, { multiplier: number; score: number; reasons: string[] }>;
}

function normalizeMarketKey(cityName: string, countryCode: string) {
  return `${cityName.trim().toLowerCase().replace(/\s+/g, "-")}-${countryCode.trim().toLowerCase()}`;
}

function loadCalendars(): UniversityMarket[] {
  if (cachedCalendars) {
    return cachedCalendars;
  }

  try {
    const raw = readFileSync(UNIVERSITY_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    cachedCalendars = Array.isArray(parsed) ? (parsed as UniversityMarket[]) : [];
  } catch {
    cachedCalendars = [];
  }

  return cachedCalendars;
}

function impactToMultiplier(impact: UniversityImpact) {
  if (impact === "high") return 1.1;
  if (impact === "medium") return 1.06;
  return 1.03;
}

function impactToScore(impact: UniversityImpact) {
  if (impact === "high") return 85;
  if (impact === "medium") return 60;
  return 35;
}

function dateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  for (
    const cursor = new Date(start.getTime());
    cursor.getTime() <= end.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

export function getUniversityDemandSignal(params: {
  cityName: string;
  countryCode: string;
  analysisDates: string[];
}): UniversityDemandSignal {
  const marketKey = normalizeMarketKey(params.cityName, params.countryCode);
  const dataset = loadCalendars();
  const market = dataset.find((entry) => entry.marketKey === marketKey);

  const campusDemandByDate: UniversityDemandSignal["campusDemandByDate"] = Object.fromEntries(
    params.analysisDates.map((date) => [date, { multiplier: 1, score: 0, reasons: [] }])
  );

  if (!market) {
    return {
      marketKey,
      source: "fallback",
      campusDemandDays: 0,
      campusDemandByDate
    };
  }

  market.events.forEach((event) => {
    const multiplier = impactToMultiplier(event.impact);
    const score = impactToScore(event.impact);
    const coveredDates = dateRange(event.startDate, event.endDate);

    coveredDates.forEach((date) => {
      const entry = campusDemandByDate[date];
      if (!entry) return;
      if (multiplier > entry.multiplier) {
        entry.multiplier = multiplier;
        entry.score = score;
      } else if (score > entry.score) {
        entry.score = score;
      }
      entry.reasons.push(event.name);
    });
  });

  const campusDemandDays = Object.values(campusDemandByDate).filter((entry) => entry.multiplier > 1).length;

  return {
    marketKey,
    source: "dataset",
    campusDemandDays,
    campusDemandByDate
  };
}
