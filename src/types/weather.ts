import type { WeatherCategory } from "./common";

export interface WeatherPoint {
  timestamp: string;
  temp: number;
  humidity: number;
  pop: number;
  conditionCode: number;
  conditionText: string;
  icon: string;
  windSpeed: number;
}

export interface WeatherForecast {
  city: string;
  country: string;
  timezone: number;
  points: WeatherPoint[];
}

export interface WeatherDailySummary {
  date: string;
  label: string;
  avgTemp: number;
  maxPop: number;
  category: WeatherCategory;
  icon: string;
}

export interface GeocodingResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export interface OpenWeatherForecastResponse {
  list: Array<{
    dt_txt: string;
    main: {
      temp: number;
      humidity: number;
    };
    pop: number;
    weather: Array<{
      id: number;
      main: string;
      icon: string;
    }>;
    wind: {
      speed: number;
    };
  }>;
  city: {
    name: string;
    country: string;
    timezone: number;
  };
}
