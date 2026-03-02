import type {
  GeocodingResult,
  OpenWeatherForecastResponse,
  WeatherDailySummary,
  WeatherForecast,
  WeatherPoint
} from "../types/weather";
import type { WeatherCategory } from "../types/common";
import { format } from "date-fns";
import { apiFetch } from "./apiClient";
import { apiPath } from "./backendBaseUrl";

export function mapWeatherCodeToCategory(code: number): WeatherCategory {
  if (code === 800) return "sunny";
  if (code === 801) return "partly_cloudy";
  if (code >= 802 && code <= 804) return "cloudy";
  if (code >= 200 && code <= 232) return "storm";
  if (code >= 300 && code <= 321) return "light_rain";
  if (code >= 500 && code <= 531) return "rain";
  if (code >= 600 && code <= 622) return "snow";
  return "fog";
}

export async function geocodeCity(query: string, limit = 5) {
  return apiFetch<GeocodingResult[]>(apiPath("/api/weather/geocode"), {
    params: {
      q: query,
      limit
    }
  });
}

export async function getForecastByCoordinates(latitude: number, longitude: number) {
  const response = await apiFetch<OpenWeatherForecastResponse>(apiPath("/api/weather/forecast"), {
    params: {
      latitude,
      longitude,
      units: "metric"
    }
  });

  const points: WeatherPoint[] = response.list.map((item) => ({
    timestamp: item.dt_txt,
    temp: item.main.temp,
    humidity: item.main.humidity,
    pop: item.pop,
    conditionCode: item.weather[0].id,
    conditionText: item.weather[0].main,
    icon: item.weather[0].icon,
    windSpeed: item.wind.speed
  }));

  const forecast: WeatherForecast = {
    city: response.city.name,
    country: response.city.country,
    timezone: response.city.timezone,
    points
  };

  return forecast;
}

export function getDailyForecastSummary(forecast: WeatherForecast): WeatherDailySummary[] {
  const grouped = new Map<string, WeatherPoint[]>();

  forecast.points.forEach((point) => {
    const dayKey = point.timestamp.slice(0, 10);
    const existing = grouped.get(dayKey) ?? [];
    existing.push(point);
    grouped.set(dayKey, existing);
  });

  return Array.from(grouped.entries())
    .slice(0, 5)
    .map(([dayKey, points]) => {
      const avgTemp = points.reduce((sum, p) => sum + p.temp, 0) / points.length;
      const highestPopPoint = points.reduce((best, point) => (point.pop > best.pop ? point : best), points[0]);

      return {
        date: dayKey,
        label: format(new Date(dayKey), "EEE, MMM d"),
        avgTemp,
        maxPop: highestPopPoint.pop,
        category: mapWeatherCodeToCategory(highestPopPoint.conditionCode),
        icon: highestPopPoint.icon
      };
    });
}
