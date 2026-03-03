import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, isValid, parseISO } from "date-fns";
import { getHotelsByCity, getHotelsByGeocode, getHotelOffers } from "../../services/amadeusApi";
import { ApiError } from "../../services/apiClient";
import { getEventsNearLocation } from "../../services/eventsApi";
import { getLongWeekends, getPublicHolidays } from "../../services/holidaysApi";
import { getDailyForecastSummary, getForecastByCoordinates } from "../../services/weatherApi";
import { useSearchParams } from "../search/useSearchParams";
import type {
  ActionRecommendation,
  DashboardApiErrorDetail,
  DashboardApiErrorSource,
  DashboardApiErrorState,
  DashboardModel,
  DemandInsight,
  SourceHealthRow
} from "../../types/dashboard";
import { calculatePricingRecommendation, clampDailyRateChange, daysUntil, average } from "../../utils/priceUtils";
import type { HotelType, WeatherCategory } from "../../types/common";
import { getNextThirtyDays, toUtcIsoEnd, toUtcIsoStart } from "../../utils/dateUtils";
import type { LongWeekend, PublicHoliday } from "../../types/holidays";

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeEventDate(rawDate: string) {
  if (rawDate.includes("T")) {
    return rawDate.slice(0, 10);
  }
  return rawDate;
}

function getTierFromHotelType(hotelType: HotelType): "budget" | "midscale" | "luxury" {
  if (hotelType === "business" || hotelType === "city" || hotelType === "bnb") {
    return "budget";
  }

  if (hotelType === "leisure") {
    return "midscale";
  }

  return "luxury";
}

function weatherForDate(date: string, weatherByDate: Map<string, WeatherCategory>) {
  return weatherByDate.get(date) ?? "cloudy";
}

export function normalizePublicHolidayEntries(input: unknown): PublicHoliday[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter((entry) => typeof entry.date === "string")
    .map((entry) => ({
      date: String(entry.date),
      localName: typeof entry.localName === "string" ? entry.localName : "",
      name: typeof entry.name === "string" ? entry.name : "",
      countryCode: typeof entry.countryCode === "string" ? entry.countryCode : "",
      global: Boolean(entry.global),
      counties: Array.isArray(entry.counties) ? entry.counties.filter((value): value is string => typeof value === "string") : null,
      types: Array.isArray(entry.types) ? entry.types.filter((value): value is string => typeof value === "string") : [],
      launchYear: typeof entry.launchYear === "number" ? entry.launchYear : null
    }));
}

export function normalizeLongWeekendEntries(input: unknown): LongWeekend[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .filter((entry) => typeof entry.startDate === "string" && typeof entry.endDate === "string")
    .map((entry) => ({
      startDate: String(entry.startDate),
      endDate: String(entry.endDate),
      dayCount: typeof entry.dayCount === "number" ? entry.dayCount : 0,
      needBridgeDay: Boolean(entry.needBridgeDay)
    }));
}

function longWeekendDates(longWeekends: LongWeekend[]) {
  const dates = new Set<string>();

  longWeekends.forEach((weekend) => {
    const start = parseISO(weekend.startDate);
    const end = parseISO(weekend.endDate);

    if (!isValid(start) || !isValid(end) || start > end) {
      return;
    }

    const days = eachDayOfInterval({ start, end });
    days.forEach((date) => dates.add(format(date, "yyyy-MM-dd")));
  });

  return dates;
}

function stringifyRawError(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined) {
    return "No error details provided.";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toDashboardApiError(source: DashboardApiErrorSource, error: unknown): DashboardApiErrorDetail {
  if (error instanceof ApiError) {
    const detailsMessage =
      error.details &&
      typeof error.details === "object" &&
      "message" in error.details &&
      typeof (error.details as { message?: unknown }).message === "string"
        ? ((error.details as { message: string }).message ?? "").trim()
        : "";

    return {
      source,
      status: error.status,
      message: detailsMessage || error.message || `Request failed: ${error.status}`,
      raw: stringifyRawError(error.details)
    };
  }

  if (error instanceof Error) {
    return {
      source,
      message: error.message || "Unknown error",
      raw: stringifyRawError({ name: error.name, message: error.message })
    };
  }

  return {
    source,
    message: "Unknown error",
    raw: stringifyRawError(error)
  };
}

function safePercentDelta(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return 0;
  }
  return ((current - previous) / previous) * 100;
}

function actionForDemand(
  demandInsight: DemandInsight,
  adr: number,
  occupancy: number,
  weatherRiskDays: number,
  eventDays: number,
  confidenceScore: number
): ActionRecommendation[] {
  const confidence = clampNumber(Math.round(confidenceScore), 25, 95);
  const action: ActionRecommendation["action"] =
    demandInsight.index >= 70 ? "raise" : demandInsight.index <= 40 ? "lower" : "hold";

  const actionImpactPct = action === "raise" ? 0.08 : action === "lower" ? -0.06 : 0.015;
  const primaryAdrImpact = adr * actionImpactPct;

  const recommendations: ActionRecommendation[] = [
    {
      id: "primary-action",
      action,
      title: action === "raise" ? "Raise next-7-day rates" : action === "lower" ? "Soften next-7-day rates" : "Hold rates with minor tuning",
      rationale:
        action === "raise"
          ? "Demand pressure is elevated from occupancy/events/holidays."
          : action === "lower"
            ? "Demand pressure is soft and conversion is likely more price-sensitive."
            : "Signals are balanced; maintain stability and optimize selectively.",
      expectedAdrImpact: primaryAdrImpact,
      expectedRevparImpact: primaryAdrImpact * (occupancy / 100),
      confidence
    },
    {
      id: "event-action",
      action: eventDays > 0 ? "raise" : "hold",
      title: eventDays > 0 ? "Apply event-night premium windows" : "Monitor event feed for new spikes",
      rationale:
        eventDays > 0
          ? `${eventDays} upcoming dates show event demand uplift; use day-specific premiums.`
          : "No strong event spikes in the current horizon.",
      expectedAdrImpact: eventDays > 0 ? adr * 0.04 : 0,
      expectedRevparImpact: eventDays > 0 ? adr * 0.04 * (occupancy / 100) : 0,
      confidence: clampNumber(confidence - 5, 20, 95)
    },
    {
      id: "weather-risk-action",
      action: weatherRiskDays >= 2 ? "lower" : "hold",
      title: weatherRiskDays >= 2 ? "Hedge weather-risk days" : "Keep weather-neutral strategy",
      rationale:
        weatherRiskDays >= 2
          ? `${weatherRiskDays} upcoming weather-risk days detected; lower risk of occupancy drop with targeted discounts.`
          : "Weather outlook is stable enough for baseline strategy.",
      expectedAdrImpact: weatherRiskDays >= 2 ? -adr * 0.03 : adr * 0.005,
      expectedRevparImpact: weatherRiskDays >= 2 ? -adr * 0.03 * (occupancy / 100) : adr * 0.005 * (occupancy / 100),
      confidence: clampNumber(confidence - 10, 20, 95)
    }
  ];

  return recommendations;
}

function queryStatus(
  isLoading: boolean,
  isFetching: boolean,
  hasError: boolean
): SourceHealthRow["status"] {
  if (hasError) return "error";
  if (isLoading || isFetching) return "loading";
  return "ok";
}

export function useDashboardData() {
  const params = useSearchParams();

  const hotelsQuery = useQuery({
    queryKey: ["hotels", params.latitude, params.longitude, params.cityCode, params.countryCode],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      let geocodeError: unknown;

      try {
        const geocodeResult = await getHotelsByGeocode({
          latitude: params.latitude,
          longitude: params.longitude,
          radius: 12,
          radiusUnit: "KM"
        });

        if ((geocodeResult.data ?? []).length > 0) {
          return geocodeResult.data;
        }
      } catch (error) {
        geocodeError = error;
      }

      if (params.cityCode) {
        const byCityResult = await getHotelsByCity({
          cityCode: params.cityCode,
          radius: 12,
          radiusUnit: "KM"
        });
        return byCityResult.data;
      }

      if (geocodeError) {
        throw geocodeError;
      }

      return [];
    }
  });

  const hotelIds = useMemo(
    () =>
      (hotelsQuery.data ?? [])
        .slice(0, 12)
        .map((hotel) => hotel.hotelId)
        .join(","),
    [hotelsQuery.data]
  );

  const offersQuery = useQuery({
    queryKey: ["hotel-offers", hotelIds, params.checkInDate, params.checkOutDate, params.adults],
    staleTime: 5 * 60 * 1000,
    enabled: hotelIds.length > 0,
    queryFn: async () => {
      const result = await getHotelOffers({
        hotelIds,
        adults: params.adults,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        bestRateOnly: true
      });
      return result.data;
    }
  });

  const eventsQuery = useQuery({
    queryKey: ["events", params.latitude, params.longitude, params.checkInDate, params.checkOutDate],
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      getEventsNearLocation({
        latitude: params.latitude,
        longitude: params.longitude,
        startDateTime: toUtcIsoStart(params.checkInDate),
        endDateTime: toUtcIsoEnd(params.checkOutDate),
        radius: 20,
        unit: "miles",
        size: 100,
        sort: "date,asc"
      })
  });

  const holidaysQuery = useQuery({
    queryKey: ["holidays", params.countryCode, params.checkInDate, params.checkOutDate],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const years = new Set([
        parseISO(params.checkInDate).getFullYear(),
        parseISO(params.checkOutDate).getFullYear()
      ]);

      const requests = Array.from(years).map(async (year) => {
        const [publicHolidays, longWeekends] = await Promise.all([
          getPublicHolidays(year, params.countryCode),
          getLongWeekends(year, params.countryCode)
        ]);
        return {
          publicHolidays: normalizePublicHolidayEntries(publicHolidays),
          longWeekends: normalizeLongWeekendEntries(longWeekends)
        };
      });

      const yearsData = await Promise.all(requests);

      return {
        publicHolidays: yearsData.flatMap((entry) => entry.publicHolidays),
        longWeekends: yearsData.flatMap((entry) => entry.longWeekends)
      };
    }
  });

  const weatherQuery = useQuery({
    queryKey: ["weather", params.latitude, params.longitude],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const forecast = await getForecastByCoordinates(params.latitude, params.longitude);
      return getDailyForecastSummary(forecast);
    }
  });

  const apiError = useMemo<DashboardApiErrorState | null>(() => {
    const details: DashboardApiErrorDetail[] = [];

    if (hotelsQuery.error) details.push(toDashboardApiError("hotels", hotelsQuery.error));
    if (offersQuery.error) details.push(toDashboardApiError("offers", offersQuery.error));
    if (eventsQuery.error) details.push(toDashboardApiError("events", eventsQuery.error));
    if (holidaysQuery.error) details.push(toDashboardApiError("holidays", holidaysQuery.error));
    if (weatherQuery.error) details.push(toDashboardApiError("weather", weatherQuery.error));

    if (!details.length) return null;

    return {
      summary: "Something went wrong while loading API data.",
      details
    };
  }, [eventsQuery.error, holidaysQuery.error, hotelsQuery.error, offersQuery.error, weatherQuery.error]);

  const model = useMemo<DashboardModel>(() => {
    const offerPrices = (offersQuery.data ?? []).flatMap((hotel) =>
      hotel.offers
        .map((offer) => Number(offer.price.variations?.average?.base ?? offer.price.total))
        .filter((price) => Number.isFinite(price))
    );

    const baseRate = offerPrices.length ? average(offerPrices) : 220;
    const dates = getNextThirtyDays(params.checkInDate);
    const rawEvents = eventsQuery.data?.events ?? [];
    const seenEventKeys = new Set<string>();
    const events = rawEvents.filter((event) => {
      const key = `${event.name}|${normalizeEventDate(event.date)}|${event.venueName ?? ""}`;
      if (seenEventKeys.has(key)) return false;
      seenEventKeys.add(key);
      return true;
    });
    const weather = weatherQuery.data ?? [];
    const publicHolidays = normalizePublicHolidayEntries(holidaysQuery.data?.publicHolidays ?? []);
    const longWeekends = normalizeLongWeekendEntries(holidaysQuery.data?.longWeekends ?? []);

    const eventMap = new Map<string, number>();
    events.forEach((event) => {
      const key = normalizeEventDate(event.date);
      const score = 1 + Math.min(2.5, event.popularityScore / 120 + (event.maxPrice ?? 0) / 500);
      eventMap.set(key, Math.max(eventMap.get(key) ?? 1, score));
    });

    const weatherByDate = new Map<string, WeatherCategory>();
    weather.forEach((day) => {
      weatherByDate.set(day.date, day.category);
    });

    const holidayDates = new Set(
      publicHolidays
        .filter((holiday) => Array.isArray(holiday.types) && holiday.types.some((type) => type === "Public" || type === "Bank"))
        .map((holiday) => holiday.date)
        .filter((date) => typeof date === "string" && date.length > 0)
    );

    const longWeekendDateSet = longWeekendDates(longWeekends);

    let previousRate = baseRate;
    const tier = getTierFromHotelType(params.hotelType);

    const pricing = dates.map((date) => {
      const eventIntensity = eventMap.get(date) ?? 1;
      const weatherCategory = weatherForDate(date, weatherByDate);
      const isHoliday = holidayDates.has(date);
      const isLongWeekend = longWeekendDateSet.has(date);

      const recommendation = calculatePricingRecommendation({
        date,
        baseRate,
        occupancyRate: params.estimatedOccupancy,
        hotelType: params.hotelType,
        eventIntensity,
        weatherCategory,
        isHoliday,
        isLongWeekend,
        daysUntilCheckIn: Math.max(0, daysUntil(date)),
        tier
      });

      const clampedRate = clampDailyRateChange(previousRate, recommendation.finalRate, 0.2);
      previousRate = clampedRate;

      const reasons: string[] = [];
      if (eventIntensity > 1.2) reasons.push("Event demand uplift");
      if (isHoliday) reasons.push("Public/bank holiday");
      if (isLongWeekend) reasons.push("Long weekend travel");
      if (weatherCategory === "storm" || weatherCategory === "rain" || weatherCategory === "snow") {
        reasons.push("Weather risk adjustment");
      }
      if (!reasons.length) reasons.push("Baseline market conditions");

      return {
        ...recommendation,
        finalRate: clampedRate,
        finalMultiplier: clampedRate / recommendation.baseRate
      };
    });

    const currentWindow = pricing.slice(0, 7);
    const previousWindow = pricing.slice(7, 14);

    const adr = average(pricing.map((item) => item.finalRate));
    const occupancy = params.estimatedOccupancy;
    const multiplierBaseline = Math.max(0.7, average(pricing.map((item) => item.finalMultiplier)));
    const estimatedOccupancySeries = pricing.map((item) =>
      clampNumber((occupancy * item.finalMultiplier) / multiplierBaseline, 25, 100)
    );
    const currentAdr = average(currentWindow.map((item) => item.finalRate));
    const previousAdr = average(previousWindow.map((item) => item.finalRate));
    const currentOcc = average(estimatedOccupancySeries.slice(0, 7));
    const previousOcc = average(estimatedOccupancySeries.slice(7, 14));
    const currentRevpar = currentAdr * (occupancy / 100);
    const previousRevpar = previousAdr * (occupancy / 100);
    const activeMultiplier = pricing[0]?.finalMultiplier ?? 1;
    const previousMultiplier = average(previousWindow.map((item) => item.finalMultiplier));

    const hasHotels = (hotelsQuery.data ?? []).length > 0;
    const hasOffers = offerPrices.length > 0;
    const hasEvents = events.length > 0;
    const hasHolidays = holidayDates.size > 0 || longWeekendDateSet.size > 0;
    const hasWeather = weather.length > 0;

    const dataConfidence =
      (hasHotels && hasOffers ? 35 : 0) +
      (hasEvents ? 20 : 0) +
      (hasHolidays ? 15 : 0) +
      (hasWeather ? 15 : 0) +
      (!apiError ? 15 : 0);

    const maxEventIntensity = Math.max(1, ...Array.from(eventMap.values()));
    const eventSignal = clampNumber(((maxEventIntensity - 1) / 2.5) * 100, 0, 100);
    const upcomingSevenDates = dates.slice(0, 7);
    const holidaySignal = clampNumber(
      (upcomingSevenDates.filter((date) => holidayDates.has(date) || longWeekendDateSet.has(date)).length / 7) * 100,
      0,
      100
    );
    const leadDays = Math.max(0, daysUntil(params.checkInDate));
    const leadTimeSignal = clampNumber(100 - leadDays * 2, 0, 100);
    const occupancySignal = clampNumber(params.estimatedOccupancy, 0, 100);
    const demandPressureIndex = Math.round(
      occupancySignal * 0.4 + eventSignal * 0.25 + holidaySignal * 0.2 + leadTimeSignal * 0.15
    );
    const demandLevel: DemandInsight["level"] =
      demandPressureIndex >= 80 ? "peak" : demandPressureIndex >= 60 ? "high" : demandPressureIndex >= 35 ? "moderate" : "low";

    const holidayDays = dates.filter((date) => holidayDates.has(date)).length;
    const longWeekendDays = dates.filter((date) => longWeekendDateSet.has(date)).length;
    const weatherRiskDays = weather.filter((day) => day.category === "storm" || day.category === "rain" || day.category === "snow").length;
    const eventDays = dates.filter((date) => (eventMap.get(date) ?? 1) > 1).length;
    const highDemandDays = pricing.filter((item) => item.finalMultiplier >= 1.25).length;

    const demandInsight: DemandInsight = {
      index: demandPressureIndex,
      level: demandLevel,
      occupancySignal,
      eventSignal,
      holidaySignal,
      leadTimeSignal
    };

    return {
      pricing,
      events,
      weather,
      kpis: {
        adr,
        revpar: adr * (occupancy / 100),
        occupancy,
        activeMultiplier,
        adrDeltaPct: safePercentDelta(currentAdr, previousAdr),
        revparDeltaPct: safePercentDelta(currentRevpar, previousRevpar),
        occupancyDeltaPct: safePercentDelta(currentOcc, previousOcc),
        activeMultiplierDelta: activeMultiplier - (previousMultiplier || activeMultiplier),
        demandPressureIndex,
        dataConfidence
      },
      insights: {
        demand: demandInsight,
        dataQuality: {
          confidenceScore: dataConfidence,
          availableSources: [hasHotels && hasOffers, hasEvents, hasHolidays, hasWeather].filter(Boolean).length,
          totalSources: 4,
          hasApiErrors: Boolean(apiError),
          missingSources: [
            ...(hasHotels && hasOffers ? [] : ["Hotels & Offers"]),
            ...(hasEvents ? [] : ["Events"]),
            ...(hasHolidays ? [] : ["Holidays"]),
            ...(hasWeather ? [] : ["Weather"])
          ]
        },
        actions: actionForDemand(demandInsight, adr, occupancy, weatherRiskDays, eventDays, dataConfidence),
        signals: {
          eventDays,
          holidayDays,
          longWeekendDays,
          weatherRiskDays,
          highDemandDays
        }
      }
    };
  }, [
    apiError,
    eventsQuery.data?.events,
    holidaysQuery.data?.longWeekends,
    holidaysQuery.data?.publicHolidays,
    hotelsQuery.data,
    offersQuery.data,
    params.checkInDate,
    params.estimatedOccupancy,
    params.hotelType,
    weatherQuery.data
  ]);

  const eventDates = useMemo(() => new Set(model.events.map((event) => normalizeEventDate(event.date))), [model.events]);
  const holidayDates = useMemo(
    () =>
      new Set(
        normalizePublicHolidayEntries(holidaysQuery.data?.publicHolidays ?? [])
          .filter((holiday) => Array.isArray(holiday.types) && holiday.types.some((type) => type === "Public" || type === "Bank"))
          .map((holiday) => holiday.date)
      ),
    [holidaysQuery.data?.publicHolidays]
  );
  const longWeekendDateSet = useMemo(
    () => longWeekendDates(normalizeLongWeekendEntries(holidaysQuery.data?.longWeekends ?? [])),
    [holidaysQuery.data?.longWeekends]
  );
  const highDemandDates = useMemo(
    () => new Set(model.pricing.filter((day) => day.finalMultiplier >= 1.25).map((day) => day.date)),
    [model.pricing]
  );
  const pricingReasonsByDate = useMemo(() => {
    const byDate = new Map<string, string[]>();
    model.pricing.forEach((day) => {
      const reasons: string[] = [];
      if ((eventDates.has(day.date))) reasons.push("Event demand uplift");
      if (holidayDates.has(day.date)) reasons.push("Public/bank holiday");
      if (longWeekendDateSet.has(day.date)) reasons.push("Long weekend travel");
      if (day.factors.weather < 0.97) reasons.push("Weather risk adjustment");
      if (!reasons.length) reasons.push("Baseline market conditions");
      byDate.set(day.date, reasons);
    });
    return byDate;
  }, [eventDates, holidayDates, longWeekendDateSet, model.pricing]);

  const sourceHealth = useMemo<SourceHealthRow[]>(() => {
    const errorMap = new Map(apiError?.details.map((detail) => [detail.source, detail.message]) ?? []);

    return [
      {
        source: "Hotels",
        status: queryStatus(
          hotelsQuery.isLoading || offersQuery.isLoading,
          hotelsQuery.isFetching || offersQuery.isFetching,
          Boolean(hotelsQuery.error || offersQuery.error)
        ),
        errorSummary: errorMap.get("hotels") ?? errorMap.get("offers"),
        lastUpdated:
          Math.max(hotelsQuery.dataUpdatedAt ?? 0, offersQuery.dataUpdatedAt ?? 0) > 0
            ? new Date(Math.max(hotelsQuery.dataUpdatedAt ?? 0, offersQuery.dataUpdatedAt ?? 0)).toISOString()
            : undefined
      },
      {
        source: "Events",
        status: queryStatus(eventsQuery.isLoading, eventsQuery.isFetching, Boolean(eventsQuery.error)),
        errorSummary: errorMap.get("events"),
        lastUpdated: eventsQuery.dataUpdatedAt ? new Date(eventsQuery.dataUpdatedAt).toISOString() : undefined
      },
      {
        source: "Holidays",
        status: queryStatus(holidaysQuery.isLoading, holidaysQuery.isFetching, Boolean(holidaysQuery.error)),
        errorSummary: errorMap.get("holidays"),
        lastUpdated: holidaysQuery.dataUpdatedAt ? new Date(holidaysQuery.dataUpdatedAt).toISOString() : undefined
      },
      {
        source: "Weather",
        status: queryStatus(weatherQuery.isLoading, weatherQuery.isFetching, Boolean(weatherQuery.error)),
        errorSummary: errorMap.get("weather"),
        lastUpdated: weatherQuery.dataUpdatedAt ? new Date(weatherQuery.dataUpdatedAt).toISOString() : undefined
      }
    ];
  }, [
    apiError?.details,
    eventsQuery.dataUpdatedAt,
    eventsQuery.error,
    eventsQuery.isFetching,
    eventsQuery.isLoading,
    holidaysQuery.dataUpdatedAt,
    holidaysQuery.error,
    holidaysQuery.isFetching,
    holidaysQuery.isLoading,
    hotelsQuery.dataUpdatedAt,
    hotelsQuery.error,
    hotelsQuery.isFetching,
    hotelsQuery.isLoading,
    offersQuery.dataUpdatedAt,
    offersQuery.error,
    offersQuery.isFetching,
    offersQuery.isLoading,
    weatherQuery.dataUpdatedAt,
    weatherQuery.error,
    weatherQuery.isFetching,
    weatherQuery.isLoading
  ]);

  return {
    model,
    apiError,
    eventDates,
    holidayDates,
    longWeekendDates: longWeekendDateSet,
    highDemandDates,
    pricingReasonsByDate,
    sourceHealth,
    isLoading:
      hotelsQuery.isLoading || offersQuery.isLoading || eventsQuery.isLoading || holidaysQuery.isLoading || weatherQuery.isLoading,
    isFetching:
      hotelsQuery.isFetching || offersQuery.isFetching || eventsQuery.isFetching || holidaysQuery.isFetching || weatherQuery.isFetching
  };
}
