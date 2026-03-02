import { Building2, CalendarDays, HelpCircle, Loader2, MapPin, Play, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { useDebounce } from "../../hooks/useDebounce";
import { geocodeCity } from "../../services/weatherApi";
import { useSearchStore } from "../../store/useSearchStore";
import type { HotelType } from "../../types/common";
import type { LocationOption } from "../../types/location";
import type { GeocodingResult } from "../../types/weather";
import { majorLocations } from "./majorLocations";

const quickCityPresets: LocationOption[] = [
  {
    id: "aus-us",
    cityName: "Austin",
    cityCode: "AUS",
    countryCode: "US",
    latitude: 30.2672,
    longitude: -97.7431,
    label: "Austin, US"
  },
  {
    id: "nyc-us",
    cityName: "New York",
    cityCode: "NYC",
    countryCode: "US",
    latitude: 40.7128,
    longitude: -74.006,
    label: "New York, US"
  },
  {
    id: "lon-gb",
    cityName: "London",
    cityCode: "LON",
    countryCode: "GB",
    latitude: 51.5074,
    longitude: -0.1278,
    label: "London, GB"
  },
  {
    id: "dxb-ae",
    cityName: "Dubai",
    cityCode: "DXB",
    countryCode: "AE",
    latitude: 25.2048,
    longitude: 55.2708,
    label: "Dubai, AE"
  },
  {
    id: "tyo-jp",
    cityName: "Tokyo",
    cityCode: "TYO",
    countryCode: "JP",
    latitude: 35.6762,
    longitude: 139.6503,
    label: "Tokyo, JP"
  }
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

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9,\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function parseSearchIntent(query: string) {
  const [rawCityPart, rawCountryPart] = query.split(",").map((part) => part.trim());
  const cityPart = normalizeSearchText(rawCityPart ?? "");
  const countryPart = normalizeSearchText(rawCountryPart ?? "");
  const cityTokens = cityPart.split(" ").filter(Boolean);
  const countryHint = /^[a-z]{2}$/.test(countryPart) ? countryPart.toUpperCase() : null;

  return {
    cityPart,
    cityTokens,
    countryHint
  };
}

function geocodeToLocation(result: GeocodingResult): LocationOption {
  const countryCode = result.country.toUpperCase();
  const quickMatch = quickCityPresets.find(
    (city) => city.cityName.toLowerCase() === result.name.toLowerCase() && city.countryCode === countryCode
  );

  const label = [result.name, result.state, countryCode].filter(Boolean).join(", ");

  return {
    id: `${result.lat}:${result.lon}:${countryCode}:${result.name}`,
    cityName: result.name,
    cityCode: quickMatch?.cityCode ?? null,
    countryCode,
    state: result.state,
    latitude: result.lat,
    longitude: result.lon,
    label
  };
}

function rankLocationOption(option: LocationOption, intent: ReturnType<typeof parseSearchIntent>) {
  const city = normalizeSearchText(option.cityName);
  const state = normalizeSearchText(option.state ?? "");
  const label = normalizeSearchText(option.label);
  let score = 0;

  if (intent.countryHint) {
    score += option.countryCode === intent.countryHint ? 60 : -25;
  }

  if (intent.cityPart.length > 0) {
    if (city === intent.cityPart) score += 90;
    if (city.startsWith(intent.cityPart)) score += 40;
    if (label.includes(intent.cityPart)) score += 20;
  }

  intent.cityTokens.forEach((token) => {
    if (city.includes(token)) {
      score += 18;
      return;
    }
    if (state.includes(token)) {
      score += 10;
      return;
    }
    if (label.includes(token)) {
      score += 6;
      return;
    }
    score -= 12;
  });

  if (option.cityCode) {
    score += 6;
  }

  return score;
}

function locationKey(option: LocationOption) {
  return `${normalizeSearchText(option.cityName)}|${option.countryCode}|${normalizeSearchText(option.state ?? "")}`;
}

const majorCityKeySet = new Set(majorLocations.map((location) => locationKey(location)));

function isMajorLocation(option: LocationOption) {
  return majorCityKeySet.has(locationKey(option));
}

function locationMatchesIntent(option: LocationOption, intent: ReturnType<typeof parseSearchIntent>) {
  if (intent.countryHint && option.countryCode !== intent.countryHint) {
    return false;
  }

  if (!intent.cityTokens.length) {
    return true;
  }

  const haystack = normalizeSearchText(`${option.cityName} ${option.state ?? ""} ${option.label}`);
  return intent.cityTokens.every((token) => haystack.includes(token));
}

function isHighConfidenceIntentMatch(
  option: LocationOption,
  intent: ReturnType<typeof parseSearchIntent>,
  score: number
) {
  if (intent.countryHint && option.countryCode !== intent.countryHint) {
    return false;
  }

  const normalizedCity = normalizeSearchText(option.cityName);
  if (intent.cityPart.length > 0 && normalizedCity === intent.cityPart) {
    return true;
  }

  if (intent.cityPart.length >= 3 && normalizedCity.startsWith(intent.cityPart)) {
    return true;
  }

  return score >= 110;
}

export function SearchPanel() {
  const {
    cityName,
    countryCode,
    checkInDate,
    checkOutDate,
    adults,
    hotelType,
    estimatedOccupancy,
    searchToken,
    setCity,
    setDates,
    setAdults,
    setHotelType,
    setEstimatedOccupancy,
    runAnalysis
  } = useSearchStore();
  const [cityQuery, setCityQuery] = useState([cityName, countryCode].filter(Boolean).join(", "));
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isSearchingCities, setIsSearchingCities] = useState(false);
  const [candidateLocations, setCandidateLocations] = useState<LocationOption[]>(majorLocations.slice(0, 16));
  const [strictMatchIds, setStrictMatchIds] = useState<string[]>(majorLocations.slice(0, 16).map((location) => location.id));
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [citySearchError, setCitySearchError] = useState<string | null>(null);
  const debouncedCityQuery = useDebounce(cityQuery, 350);

  const strictMatchSet = useMemo(() => new Set(strictMatchIds), [strictMatchIds]);

  const suggestions = useMemo(() => {
    if (showAllMatches) {
      return candidateLocations.slice(0, 24);
    }

    const strictMatches = candidateLocations.filter((location) => strictMatchSet.has(location.id));
    const primaryMatches = strictMatches.length ? strictMatches : candidateLocations;
    return primaryMatches.slice(0, 8);
  }, [candidateLocations, showAllMatches, strictMatchSet]);

  const hasMoreMatches = useMemo(() => {
    const strictMatches = candidateLocations.filter((location) => strictMatchSet.has(location.id));
    const collapsedCount = strictMatches.length ? Math.min(8, strictMatches.length) : Math.min(8, candidateLocations.length);
    return candidateLocations.length > collapsedCount;
  }, [candidateLocations, strictMatchSet]);

  useEffect(() => {
    setCityQuery([cityName, countryCode].filter(Boolean).join(", "));
  }, [cityName, countryCode]);

  useEffect(() => {
    const query = debouncedCityQuery.trim();
    if (query.length < 2) {
      setCandidateLocations(majorLocations.slice(0, 16));
      setStrictMatchIds(majorLocations.slice(0, 16).map((location) => location.id));
      setCitySearchError(null);
      setIsSearchingCities(false);
      return;
    }

    let cancelled = false;
    setIsSearchingCities(true);
    setCitySearchError(null);

    geocodeCity(query, 20)
      .then((results) => {
        if (cancelled) return;
        const intent = parseSearchIntent(query);
        const majorMatches = majorLocations.filter((location) => locationMatchesIntent(location, intent));
        const upstreamMatches = results.map(geocodeToLocation);

        const mergedMatches = new Map<string, LocationOption>();
        majorMatches.forEach((location) => {
          mergedMatches.set(locationKey(location), location);
        });
        upstreamMatches.forEach((location) => {
          const key = locationKey(location);
          if (!mergedMatches.has(key)) {
            mergedMatches.set(key, location);
          }
        });

        const scored = Array.from(mergedMatches.values())
          .map((location) => {
            const baseScore = rankLocationOption(location, intent);
            const majorBoost = isMajorLocation(location) ? 45 : 0;
            return {
              location,
              score: baseScore + majorBoost
            };
          })
          .sort((a, b) => b.score - a.score);

        const ordered = scored.map((entry) => entry.location);
        const strict = scored
          .filter(
            (entry) => isMajorLocation(entry.location) || isHighConfidenceIntentMatch(entry.location, intent, entry.score)
          )
          .map((entry) => entry.location.id);

        setCandidateLocations(ordered);
        setStrictMatchIds(strict);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCandidateLocations(majorLocations.slice(0, 16));
        setStrictMatchIds(majorLocations.slice(0, 16).map((location) => location.id));
        setCitySearchError(error instanceof Error ? error.message : "Unable to load city suggestions.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsSearchingCities(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedCityQuery]);

  const selectedCityValue = useMemo(() => `${cityName}-${countryCode}`, [cityName, countryCode]);

  const applyLocation = (location: LocationOption) => {
    setCity({
      cityName: location.cityName,
      cityCode: location.cityCode,
      countryCode: location.countryCode,
      latitude: location.latitude,
      longitude: location.longitude
    });
    setCityQuery(location.label);
    setShowAllMatches(false);
    setIsSuggestionOpen(false);
  };

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
        <label className="relative space-y-2 lg:col-span-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Building2 className="h-3.5 w-3.5" />
            Your Location
          </span>
          <input
            type="text"
            value={cityQuery}
            placeholder="Search city (e.g. Dubai, UAE)"
            onFocus={() => setIsSuggestionOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsSuggestionOpen(false), 120);
            }}
            onChange={(event) => {
              setCityQuery(event.target.value);
              setShowAllMatches(false);
              setIsSuggestionOpen(true);
            }}
            className={inputClass}
          />

          {isSuggestionOpen ? (
            <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-neutral-900">
              {isSearchingCities ? (
                <p className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching locations...
                </p>
              ) : null}

              {!isSearchingCities && citySearchError ? (
                <p className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{citySearchError}</p>
              ) : null}

              {!isSearchingCities && !citySearchError && suggestions.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  No locations matched. Try typing city and country code (for example, "Berlin, DE").
                </p>
              ) : null}

              {!isSearchingCities &&
                suggestions.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyLocation(location)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-gray-100 dark:hover:bg-neutral-800"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      {location.label}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {isMajorLocation(location) ? (
                        <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-semibold text-gold-900 dark:bg-gold-900/30 dark:text-gold-300">
                          Major
                        </span>
                      ) : null}
                      {location.cityCode ? (
                        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{location.cityCode}</span>
                      ) : null}
                    </span>
                  </button>
                ))}

              {!isSearchingCities && !citySearchError && suggestions.length > 0 ? (
                <div className="mt-1 flex items-center justify-between px-2 pb-1 pt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>
                    {showAllMatches ? "Showing wider geocoder matches" : "Showing top major-city matches"}
                  </span>
                  {hasMoreMatches ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setShowAllMatches((current) => !current)}
                      className="rounded-md px-2 py-1 font-semibold text-gold-800 transition hover:bg-gold-100 dark:text-gold-300 dark:hover:bg-gold-900/30"
                    >
                      {showAllMatches ? "Show fewer" : "Show more"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Quick picks:</span>
        {quickCityPresets.map((city) => (
          <button
            key={city.id}
            type="button"
            onClick={() => applyLocation(city)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              selectedCityValue === `${city.cityName}-${city.countryCode}`
                ? "border-gold-300 bg-gold-100 text-gold-900 dark:border-gold-700/50 dark:bg-gold-900/30 dark:text-gold-300"
                : "border-gray-200 bg-white text-gray-600 hover:border-gold-300 hover:text-dune-900 dark:border-gray-700 dark:bg-neutral-900 dark:text-gray-300"
            }`}
          >
            {city.label}
          </button>
        ))}
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

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {searchToken > 0
            ? `Analysis run #${searchToken}. Provider APIs are called only when you click run.`
            : "No analysis run yet. Click Run Analysis to fetch live market data."}
        </p>
        <button
          type="button"
          onClick={runAnalysis}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 active:scale-[0.98]"
        >
          <Play className="h-4 w-4" />
          Run Analysis
        </button>
      </div>
    </Card>
  );
}
