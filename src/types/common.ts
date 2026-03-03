export type HotelType = "city" | "business" | "leisure" | "beach" | "ski" | "bnb";

export type WeatherCategory =
  | "sunny"
  | "partly_cloudy"
  | "cloudy"
  | "storm"
  | "light_rain"
  | "rain"
  | "snow"
  | "fog";

export interface DateRange {
  checkInDate: string;
  checkOutDate: string;
}
