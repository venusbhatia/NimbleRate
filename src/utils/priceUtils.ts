import { differenceInCalendarDays, getDay, parseISO } from "date-fns";
import type { HotelType, WeatherCategory } from "../types/common";
import type { PricingContext, PricingFactors, PricingRecommendation } from "../types/pricing";

const TIER_CAPS = {
  budget: 2.5,
  midscale: 3,
  luxury: 4.5
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getOccupancyMultiplier(occupancyRate: number) {
  const normalized = clamp(occupancyRate, 0, 100) / 100;
  const mult = 0.8 + 1.2 * normalized ** 1.5;
  return clamp(mult, 0.75, 2);
}

export function getDayOfWeekMultiplier(date: string, hotelType: HotelType) {
  const day = getDay(parseISO(date));

  if (hotelType === "business") {
    const businessMap = [0.8, 1.05, 1.1, 1.1, 1.05, 0.95, 0.85];
    return businessMap[day];
  }

  if (hotelType === "leisure" || hotelType === "beach") {
    const leisureMap = [1.15, 0.9, 0.8, 0.8, 0.9, 1.05, 1.2];
    return leisureMap[day];
  }

  if (hotelType === "ski") {
    const skiMap = [1.12, 0.92, 0.88, 0.9, 1, 1.1, 1.22];
    return skiMap[day];
  }

  const cityMap = [0.95, 1.02, 1.04, 1.04, 1.02, 0.98, 0.96];
  return cityMap[day];
}

export function getWeatherMultiplier(category: WeatherCategory, hotelType: HotelType) {
  if (hotelType === "beach") {
    const table: Record<WeatherCategory, number> = {
      sunny: 1.15,
      partly_cloudy: 1.08,
      cloudy: 0.95,
      light_rain: 0.88,
      rain: 0.82,
      storm: 0.68,
      snow: 0.7,
      fog: 0.9
    };
    return table[category];
  }

  if (hotelType === "ski") {
    const table: Record<WeatherCategory, number> = {
      sunny: 0.95,
      partly_cloudy: 1,
      cloudy: 1.06,
      light_rain: 0.88,
      rain: 0.82,
      storm: 0.8,
      snow: 1.2,
      fog: 0.94
    };
    return table[category];
  }

  const cityTable: Record<WeatherCategory, number> = {
    sunny: 1.02,
    partly_cloudy: 1.01,
    cloudy: 1,
    light_rain: 0.98,
    rain: 0.96,
    storm: 0.95,
    snow: 0.97,
    fog: 0.97
  };

  return cityTable[category];
}

export function getEventMultiplier(eventIntensity: number) {
  if (eventIntensity >= 2.5) return 2.2;
  if (eventIntensity >= 1.8) return 1.6;
  if (eventIntensity >= 1.3) return 1.35;
  if (eventIntensity >= 1.05) return 1.15;
  return 1;
}

export function getHolidayMultiplier(isHoliday: boolean, isLongWeekend: boolean) {
  if (isHoliday && isLongWeekend) {
    return 1.45;
  }

  if (isHoliday) {
    return 1.3;
  }

  if (isLongWeekend) {
    return 1.22;
  }

  return 1;
}

export function getLeadTimeMultiplier(daysUntilCheckIn: number) {
  if (daysUntilCheckIn <= 2) return 1.2;
  if (daysUntilCheckIn <= 7) return 1.08;
  if (daysUntilCheckIn <= 21) return 1.02;
  if (daysUntilCheckIn <= 45) return 1;
  return 0.96;
}

export function dampenedMultiplier(rawMultiplier: number) {
  if (rawMultiplier <= 2.5) {
    return rawMultiplier;
  }
  return 2.5 + Math.log2(rawMultiplier / 2.5) * 0.4;
}

export function calculatePricingRecommendation(context: PricingContext): PricingRecommendation {
  const factors: PricingFactors = {
    occupancyRate: getOccupancyMultiplier(context.occupancyRate),
    dayOfWeek: getDayOfWeekMultiplier(context.date, context.hotelType),
    seasonality: 1,
    events: getEventMultiplier(context.eventIntensity),
    weather: getWeatherMultiplier(context.weatherCategory, context.hotelType),
    holiday: getHolidayMultiplier(context.isHoliday, context.isLongWeekend),
    leadTime: getLeadTimeMultiplier(context.daysUntilCheckIn)
  };

  const rawMultiplier =
    factors.occupancyRate *
    factors.dayOfWeek *
    factors.seasonality *
    factors.events *
    factors.weather *
    factors.holiday *
    factors.leadTime;

  const maxMultiplier = TIER_CAPS[context.tier];
  const finalMultiplier = clamp(dampenedMultiplier(rawMultiplier), 0.75, maxMultiplier);

  return {
    date: context.date,
    baseRate: context.baseRate,
    rawMultiplier,
    finalMultiplier,
    finalRate: context.baseRate * finalMultiplier,
    factors
  };
}

export function clampDailyRateChange(previousRate: number, proposedRate: number, maxDelta = 0.2) {
  const floor = previousRate * (1 - maxDelta);
  const ceiling = previousRate * (1 + maxDelta);
  return clamp(proposedRate, floor, ceiling);
}

export function daysUntil(targetDate: string, fromDate = new Date()) {
  return differenceInCalendarDays(parseISO(targetDate), fromDate);
}

export function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
