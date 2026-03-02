import { Building2, CalendarDays, Users } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { useSearchStore } from "../../store/useSearchStore";
import type { HotelType } from "../../types/common";

const cityPresets = [
  { label: "New York, US", cityCode: "NYC", countryCode: "US", latitude: 40.7128, longitude: -74.006 },
  { label: "London, GB", cityCode: "LON", countryCode: "GB", latitude: 51.5074, longitude: -0.1278 },
  { label: "Paris, FR", cityCode: "PAR", countryCode: "FR", latitude: 48.8566, longitude: 2.3522 },
  { label: "Dubai, AE", cityCode: "DXB", countryCode: "AE", latitude: 25.2048, longitude: 55.2708 },
  { label: "Tokyo, JP", cityCode: "TYO", countryCode: "JP", latitude: 35.6762, longitude: 139.6503 }
];

const hotelTypeOptions: HotelType[] = ["city", "business", "leisure", "beach", "ski"];

export function SearchPanel() {
  const {
    cityCode,
    countryCode,
    checkInDate,
    checkOutDate,
    adults,
    hotelType,
    estimatedOccupancy,
    setCity,
    setDates,
    setAdults,
    setHotelType,
    setEstimatedOccupancy
  } = useSearchStore();

  return (
    <Card className="animate-fadeIn bg-white/95 p-6 dark:bg-neutral-900/95">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="space-y-2 lg:col-span-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Building2 className="h-3.5 w-3.5" />
            Market
          </span>
          <select
            value={`${cityCode}-${countryCode}`}
            onChange={(event) => {
              const selected = cityPresets.find((city) => `${city.cityCode}-${city.countryCode}` === event.target.value);
              if (selected) {
                setCity(selected);
              }
            }}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none ring-gold-300 transition focus:ring"
          >
            {cityPresets.map((city) => (
              <option key={city.label} value={`${city.cityCode}-${city.countryCode}`}>
                {city.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Check-In
          </span>
          <input
            type="date"
            value={checkInDate}
            onChange={(event) => setDates(event.target.value, checkOutDate)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none ring-gold-300 transition focus:ring"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Check-Out</span>
          <input
            type="date"
            value={checkOutDate}
            onChange={(event) => setDates(checkInDate, event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none ring-gold-300 transition focus:ring"
          />
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Users className="h-3.5 w-3.5" />
            Adults
          </span>
          <select
            value={adults}
            onChange={(event) => setAdults(Number(event.target.value))}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none ring-gold-300 transition focus:ring"
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hotel Type</span>
          <select
            value={hotelType}
            onChange={(event) => setHotelType(event.target.value as HotelType)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm capitalize outline-none ring-gold-300 transition focus:ring"
          >
            {hotelTypeOptions.map((type) => (
              <option key={type} value={type} className="capitalize">
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Estimated Occupancy</span>
          <span>{estimatedOccupancy}%</span>
        </div>
        <input
          type="range"
          min={25}
          max={100}
          step={1}
          value={estimatedOccupancy}
          onChange={(event) => setEstimatedOccupancy(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gold-200"
        />
      </div>
    </Card>
  );
}
