import { differenceInCalendarDays, getDay, parseISO } from "date-fns";
import type { PacePoint } from "./paceSimulator.js";

export type V2HotelType = "city" | "business" | "leisure" | "beach" | "ski";
export type V2WeatherCategory = "sunny" | "partly_cloudy" | "cloudy" | "light_rain" | "rain" | "storm" | "snow" | "fog";

export interface EngineSignalInput {
  date: string;
  weatherCategory: V2WeatherCategory;
  eventImpactScore: number;
  isHoliday: boolean;
  isLongWeekend: boolean;
  pace: PacePoint;
}

export interface EngineFactorBreakdown {
  occupancyRate: number;
  dayOfWeek: number;
  seasonality: number;
  events: number;
  weather: number;
  holiday: number;
  leadTime: number;
}

export interface EngineExplainabilityFactor {
  value: number;
  contribution: number;
  reason: string;
}

export interface EngineGuardrails {
  minHit: boolean;
  maxHit: boolean;
  dailyChangeCapped: boolean;
}

export interface EngineExplainability {
  headline: string;
  factors: {
    occupancyRate: EngineExplainabilityFactor;
    dayOfWeek: EngineExplainabilityFactor;
    seasonality: EngineExplainabilityFactor;
    events: EngineExplainabilityFactor;
    weather: EngineExplainabilityFactor;
    holiday: EngineExplainabilityFactor;
    leadTime: EngineExplainabilityFactor;
  };
  guardrails: EngineGuardrails;
}

export interface EngineRecommendation {
  date: string;
  baseRate: number;
  finalRate: number;
  finalMultiplier: number;
  rawMultiplier: number;
  factors: EngineFactorBreakdown;
  reasons: string[];
  explainability: EngineExplainability;
}

export interface EngineInput {
  compsetRates: number[];
  targetMarketPosition: number;
  minPrice: number;
  maxPrice: number;
  hotelType: V2HotelType;
  signals: EngineSignalInput[];
}

export interface EngineOutput {
  anchorRate: number;
  compsetMedian: number;
  compsetP25: number;
  compsetP75: number;
  confidence: "high" | "medium" | "low";
  recommendations: EngineRecommendation[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function getWeatherMultiplier(category: V2WeatherCategory, hotelType: V2HotelType) {
  if (hotelType === "beach") {
    const table: Record<V2WeatherCategory, number> = {
      sunny: 1.16,
      partly_cloudy: 1.08,
      cloudy: 0.96,
      light_rain: 0.9,
      rain: 0.84,
      storm: 0.75,
      snow: 0.82,
      fog: 0.92
    };
    return table[category];
  }

  if (hotelType === "ski") {
    const table: Record<V2WeatherCategory, number> = {
      sunny: 0.96,
      partly_cloudy: 1.02,
      cloudy: 1.04,
      light_rain: 0.9,
      rain: 0.86,
      storm: 0.82,
      snow: 1.22,
      fog: 0.95
    };
    return table[category];
  }

  const table: Record<V2WeatherCategory, number> = {
    sunny: 1.01,
    partly_cloudy: 1,
    cloudy: 1,
    light_rain: 0.99,
    rain: 0.98,
    storm: 0.96,
    snow: 0.97,
    fog: 0.98
  };
  return table[category];
}

function getDayOfWeekMultiplier(date: string, hotelType: V2HotelType) {
  const day = getDay(parseISO(date));
  if (hotelType === "business" || hotelType === "city") {
    const table = [0.82, 1.05, 1.1, 1.1, 1.04, 0.94, 0.86];
    return table[day];
  }

  const leisureTable = [1.12, 0.9, 0.84, 0.86, 0.95, 1.08, 1.2];
  return leisureTable[day];
}

function getHolidayMultiplier(isHoliday: boolean, isLongWeekend: boolean) {
  if (isHoliday && isLongWeekend) return 1.38;
  if (isHoliday) return 1.24;
  if (isLongWeekend) return 1.18;
  return 1;
}

function getLeadTimeMultiplier(targetDate: string) {
  const daysOut = differenceInCalendarDays(parseISO(targetDate), new Date());
  if (daysOut < 1) return 0.92;
  if (daysOut <= 3) return 0.98;
  if (daysOut <= 14) return 1.02;
  if (daysOut <= 45) return 1.01;
  return 1;
}

function getPaceMultiplier(pace: PacePoint) {
  const occupancy = pace.occupancyRate;
  const paceVsLy = occupancy - pace.occupancyLastYear;

  if (occupancy >= 90 && paceVsLy >= 5) return 1.4;
  if (occupancy >= 80 && paceVsLy >= 0) return 1.22;
  if (occupancy >= 65) return 1.08;
  if (occupancy >= 50) return 1;
  if (occupancy >= 35) return 0.93;
  return 0.84;
}

function getEventMultiplier(eventImpactScore: number) {
  if (eventImpactScore >= 80) return 1.6;
  if (eventImpactScore >= 60) return 1.35;
  if (eventImpactScore >= 40) return 1.18;
  if (eventImpactScore >= 20) return 1.08;
  return 1;
}

function dampen(rawMultiplier: number) {
  if (rawMultiplier > 2) {
    return 2 + Math.log2(rawMultiplier / 2) * 0.5;
  }
  if (rawMultiplier < 0.7) {
    return 0.7 + (rawMultiplier - 0.7) * 0.5;
  }
  return rawMultiplier;
}

function describeOccupancyFactor(multiplier: number, pace: PacePoint) {
  if (multiplier >= 1.25) {
    return `Strong booking pace (${pace.occupancyRate}% occ, ${pace.occupancyRate - pace.occupancyLastYear}% vs last year) increased price pressure.`;
  }
  if (multiplier >= 1.05) {
    return `Healthy booking pace (${pace.occupancyRate}% occupancy) supports a moderate uplift.`;
  }
  if (multiplier <= 0.9) {
    return `Soft booking pace (${pace.occupancyRate}% occupancy) triggered defensive pricing.`;
  }
  return "Booking pace is close to baseline.";
}

function describeDayOfWeekFactor(multiplier: number, date: string, hotelType: V2HotelType) {
  const day = getDay(parseISO(date));
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (multiplier > 1) {
    return `${dayNames[day]} demand pattern for ${hotelType} properties supports a rate uplift.`;
  }
  if (multiplier < 1) {
    return `${dayNames[day]} demand pattern for ${hotelType} properties softens pricing.`;
  }
  return `${dayNames[day]} demand pattern is neutral for ${hotelType} properties.`;
}

function describeEventFactor(multiplier: number, eventImpactScore: number) {
  if (multiplier >= 1.5) {
    return `High-impact events detected (impact score ${Math.round(eventImpactScore)}).`;
  }
  if (multiplier >= 1.2) {
    return `Moderate event demand uplift (impact score ${Math.round(eventImpactScore)}).`;
  }
  if (eventImpactScore > 0) {
    return `Minor event activity present (impact score ${Math.round(eventImpactScore)}).`;
  }
  return "No significant event-driven uplift for this date.";
}

function describeHolidayFactor(isHoliday: boolean, isLongWeekend: boolean) {
  if (isHoliday && isLongWeekend) {
    return "Public holiday overlaps with long weekend, boosting expected demand.";
  }
  if (isHoliday) {
    return "Public holiday demand uplift applied.";
  }
  if (isLongWeekend) {
    return "Long-weekend uplift applied.";
  }
  return "No holiday uplift applied.";
}

function describeWeatherFactor(multiplier: number, category: V2WeatherCategory, hotelType: V2HotelType) {
  if (multiplier > 1.05) {
    return `${category.replace("_", " ")} weather is favorable for ${hotelType} demand.`;
  }
  if (multiplier < 0.95) {
    return `${category.replace("_", " ")} weather introduces demand risk for ${hotelType} demand.`;
  }
  return `${category.replace("_", " ")} weather impact is limited for ${hotelType} demand.`;
}

function describeLeadTimeFactor(multiplier: number, date: string) {
  const daysOut = differenceInCalendarDays(parseISO(date), new Date());
  if (multiplier > 1.01) {
    return `Lead time (${daysOut} days out) supports a mild premium.`;
  }
  if (multiplier < 0.99) {
    return `Lead time (${daysOut} days out) favors conversion pricing.`;
  }
  return `Lead time (${daysOut} days out) is neutral.`;
}

function computeContributionMap(factors: EngineFactorBreakdown) {
  const entries = Object.entries(factors) as Array<[keyof EngineFactorBreakdown, number]>;
  const logs = entries.map(([key, value]) => [key, Math.log(Math.max(value, 0.0001))] as const);
  const total = logs.reduce((sum, [, value]) => sum + value, 0);

  const contributionMap = new Map<keyof EngineFactorBreakdown, number>();

  if (Math.abs(total) < 1e-9) {
    entries.forEach(([key]) => contributionMap.set(key, 0));
    return contributionMap;
  }

  logs.forEach(([key, value]) => {
    contributionMap.set(key, Number(((value / total) * 100).toFixed(1)));
  });

  return contributionMap;
}

function topContributionLabel(contributions: Map<keyof EngineFactorBreakdown, number>) {
  const label: Record<keyof EngineFactorBreakdown, string> = {
    occupancyRate: "booking pace",
    dayOfWeek: "day-of-week pattern",
    seasonality: "seasonality",
    events: "events",
    weather: "weather",
    holiday: "holiday effects",
    leadTime: "lead time"
  };

  let winner: keyof EngineFactorBreakdown = "occupancyRate";
  let winnerAbs = -1;

  contributions.forEach((value, key) => {
    const abs = Math.abs(value);
    if (abs > winnerAbs) {
      winner = key;
      winnerAbs = abs;
    }
  });

  return label[winner];
}

function buildHeadline(finalMultiplier: number, contributions: Map<keyof EngineFactorBreakdown, number>) {
  const dominantSignal = topContributionLabel(contributions);
  if (finalMultiplier >= 1.03) {
    return `Rate uplift is primarily driven by ${dominantSignal}.`;
  }
  if (finalMultiplier <= 0.97) {
    return `Rate softening is primarily driven by ${dominantSignal}.`;
  }
  return `Rate is holding close to market anchor with ${dominantSignal} as the main driver.`;
}

function buildReasons(signal: EngineSignalInput, factors: EngineFactorBreakdown) {
  const reasons: string[] = [];
  if (factors.events > 1.1) reasons.push("Event demand and attendance are elevated.");
  if (signal.isHoliday) reasons.push("Public holiday uplift applied.");
  if (signal.isLongWeekend) reasons.push("Long-weekend demand boost applied.");
  if (factors.occupancyRate > 1.1) reasons.push("Booking pace and occupancy are ahead of baseline.");
  if (factors.occupancyRate < 0.95) reasons.push("Soft booking pace triggered defensive pricing.");
  if (factors.weather < 0.98) reasons.push("Weather risk reduced price pressure.");
  if (!reasons.length) reasons.push("Market baseline conditions.");
  return reasons;
}

export function calculateV2Recommendations(input: EngineInput): EngineOutput {
  const validRates = input.compsetRates.filter((value) => Number.isFinite(value) && value > 0);
  const compsetMedian = validRates.length ? percentile(validRates, 0.5) : 220;
  const compsetP25 = validRates.length ? percentile(validRates, 0.25) : compsetMedian * 0.9;
  const compsetP75 = validRates.length ? percentile(validRates, 0.75) : compsetMedian * 1.1;
  const marketPosition = clamp(input.targetMarketPosition, 0, 1);
  const anchorRate = compsetP25 + (compsetP75 - compsetP25) * marketPosition;

  const hasPace = input.signals.some((signal) => signal.pace.occupancyRate > 0);
  const hasEvents = input.signals.some((signal) => signal.eventImpactScore > 20);
  const confidence: EngineOutput["confidence"] =
    validRates.length >= 5 && hasPace && hasEvents ? "high" : validRates.length >= 3 ? "medium" : "low";

  let previousRate = anchorRate;

  const recommendations = input.signals.map((signal) => {
    const factors: EngineFactorBreakdown = {
      occupancyRate: getPaceMultiplier(signal.pace),
      dayOfWeek: getDayOfWeekMultiplier(signal.date, input.hotelType),
      seasonality: 1,
      events: getEventMultiplier(signal.eventImpactScore),
      weather: getWeatherMultiplier(signal.weatherCategory, input.hotelType),
      holiday: getHolidayMultiplier(signal.isHoliday, signal.isLongWeekend),
      leadTime: getLeadTimeMultiplier(signal.date)
    };

    const rawMultiplier =
      factors.occupancyRate *
      factors.dayOfWeek *
      factors.seasonality *
      factors.events *
      factors.weather *
      factors.holiday *
      factors.leadTime;

    const dampened = dampen(rawMultiplier);
    const uncappedRate = anchorRate * dampened;
    const afterBoundsRate = clamp(uncappedRate, input.minPrice, input.maxPrice);
    const maxDailyDelta = previousRate * 0.2;
    const finalRate = clamp(afterBoundsRate, previousRate - maxDailyDelta, previousRate + maxDailyDelta);
    const guardrails: EngineGuardrails = {
      minHit: uncappedRate < input.minPrice,
      maxHit: uncappedRate > input.maxPrice,
      dailyChangeCapped: Math.abs(afterBoundsRate - finalRate) > 0.0001
    };
    previousRate = finalRate;

    const contributions = computeContributionMap(factors);
    const explainability: EngineExplainability = {
      headline: buildHeadline(finalRate / anchorRate, contributions),
      factors: {
        occupancyRate: {
          value: factors.occupancyRate,
          contribution: contributions.get("occupancyRate") ?? 0,
          reason: describeOccupancyFactor(factors.occupancyRate, signal.pace)
        },
        dayOfWeek: {
          value: factors.dayOfWeek,
          contribution: contributions.get("dayOfWeek") ?? 0,
          reason: describeDayOfWeekFactor(factors.dayOfWeek, signal.date, input.hotelType)
        },
        seasonality: {
          value: factors.seasonality,
          contribution: contributions.get("seasonality") ?? 0,
          reason: "Seasonality baseline is neutral in phase-1."
        },
        events: {
          value: factors.events,
          contribution: contributions.get("events") ?? 0,
          reason: describeEventFactor(factors.events, signal.eventImpactScore)
        },
        weather: {
          value: factors.weather,
          contribution: contributions.get("weather") ?? 0,
          reason: describeWeatherFactor(factors.weather, signal.weatherCategory, input.hotelType)
        },
        holiday: {
          value: factors.holiday,
          contribution: contributions.get("holiday") ?? 0,
          reason: describeHolidayFactor(signal.isHoliday, signal.isLongWeekend)
        },
        leadTime: {
          value: factors.leadTime,
          contribution: contributions.get("leadTime") ?? 0,
          reason: describeLeadTimeFactor(factors.leadTime, signal.date)
        }
      },
      guardrails
    };

    return {
      date: signal.date,
      baseRate: anchorRate,
      rawMultiplier,
      finalMultiplier: finalRate / anchorRate,
      finalRate: Math.round(finalRate),
      factors,
      reasons: buildReasons(signal, factors),
      explainability
    };
  });

  return {
    anchorRate: Math.round(anchorRate),
    compsetMedian: Math.round(compsetMedian),
    compsetP25: Math.round(compsetP25),
    compsetP75: Math.round(compsetP75),
    confidence,
    recommendations
  };
}

export function summarizeRates(rates: number[]) {
  const valid = rates.filter((value) => Number.isFinite(value) && value > 0);
  return {
    averageRate: Math.round(average(valid)),
    medianRate: Math.round(percentile(valid, 0.5)),
    sampleSize: valid.length
  };
}
