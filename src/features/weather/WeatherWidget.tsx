import { CloudRain, Cloudy, Sun, Umbrella } from "lucide-react";
import { Card } from "../../components/ui/Card";
import type { WeatherDailySummary } from "../../types/weather";

interface WeatherWidgetProps {
  weather: WeatherDailySummary[];
}

function iconForCategory(category: WeatherDailySummary["category"]) {
  switch (category) {
    case "sunny":
      return Sun;
    case "rain":
    case "light_rain":
      return CloudRain;
    case "storm":
      return Umbrella;
    default:
      return Cloudy;
  }
}

export function WeatherWidget({ weather }: WeatherWidgetProps) {
  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <h3 className="mb-4 text-lg font-semibold tracking-tight">Weather Outlook</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {weather.map((day) => {
          const Icon = iconForCategory(day.category);
          return (
            <div
              key={day.date}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-neutral-800"
            >
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{day.label}</p>
              <div className="mt-2 flex items-center justify-between">
                <Icon className="h-4 w-4 text-gold-600" />
                <span className="font-bold tabular-nums">{day.avgTemp.toFixed(0)}°C</span>
              </div>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                Rain chance: {(day.maxPop * 100).toFixed(0)}%
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
