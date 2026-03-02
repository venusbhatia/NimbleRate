import type { HotelType, WeatherCategory } from "./common";

export interface PricingFactors {
  occupancyRate: number;
  dayOfWeek: number;
  seasonality: number;
  events: number;
  weather: number;
  holiday: number;
  leadTime: number;
}

export interface PricingContext {
  baseRate: number;
  occupancyRate: number;
  hotelType: HotelType;
  date: string;
  eventIntensity: number;
  weatherCategory: WeatherCategory;
  isHoliday: boolean;
  isLongWeekend: boolean;
  daysUntilCheckIn: number;
  tier: "budget" | "midscale" | "luxury";
}

export interface PricingRecommendation {
  date: string;
  baseRate: number;
  finalRate: number;
  finalMultiplier: number;
  rawMultiplier: number;
  factors: PricingFactors;
}
