import { Building2, CalendarDays, HelpCircle, Users } from "lucide-react";
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

const hotelTypeOptions: { value: HotelType; label: string }[] = [
  { value: "city", label: "City hotel" },
  { value: "business", label: "Business hotel" },
  { value: "leisure", label: "Leisure / Resort" },
  { value: "beach", label: "Beach property" },
  { value: "ski", label: "Ski lodge" }
];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none ring-gold-300 transition focus:ring dark:border-gray-600 dark:bg-neutral-800 dark:text-gray-100";

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

  const handleCheckIn = (value: string) => {
    if (value > checkOutDate) {
      setDates(value, value);
    } else {
      setDates(value, checkOutDate);
    }
  };

  const handleCheckOut = (value: string) => {
    if (value < checkInDate) return;
    setDates(checkInDate, value);
  };

  return (
    <Card className="animate-fadeIn bg-white/95 p-6 dark:bg-neutral-900/95">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <label className="space-y-2 lg:col-span-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Building2 className="h-3.5 w-3.5" />
            Your Location
          </span>
          <select
            value={`${cityCode}-${countryCode}`}
            onChange={(event) => {
              const selected = cityPresets.find((city) => `${city.cityCode}-${city.countryCode}` === event.target.value);
              if (selected) {
                setCity(selected);
              }
            }}
            className={inputClass}
          >
            {cityPresets.map((city) => (
              <option key={city.label} value={`${city.cityCode}-${city.countryCode}`}>
                {city.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <CalendarDays className="h-3.5 w-3.5" />
            Check-In
          </span>
          <input
            type="date"
            value={checkInDate}
            onChange={(event) => handleCheckIn(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Check-Out</span>
          <input
            type="date"
            value={checkOutDate}
            min={checkInDate}
            onChange={(event) => handleCheckOut(event.target.value)}
            className={inputClass}
          />
        </label>

        <label className="space-y-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Users className="h-3.5 w-3.5" />
            Guests
          </span>
          <select
            value={adults}
            onChange={(event) => setAdults(Number(event.target.value))}
            className={inputClass}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value} {value === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Property Type</span>
          <select
            value={hotelType}
            onChange={(event) => setHotelType(event.target.value as HotelType)}
            className={inputClass}
          >
            {hotelTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            How full is your property?
            <HelpCircle className="h-3 w-3 text-gray-400" />
          </span>
          <span className="tabular-nums text-dune-900 dark:text-gray-100">{estimatedOccupancy}%</span>
        </div>
        <input
          type="range"
          min={25}
          max={100}
          step={1}
          value={estimatedOccupancy}
          onChange={(event) => setEstimatedOccupancy(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gold-200 dark:bg-gold-900/40"
        />
        <div className="mt-1 flex justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>Quiet</span>
          <span>Half full</span>
          <span>Packed</span>
        </div>
      </div>
    </Card>
  );
}
