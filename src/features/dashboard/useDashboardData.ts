import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { getHotelsByCity, getHotelOffers } from "../../services/amadeusApi";
import { getEventsNearLocation } from "../../services/eventsApi";
import { getLongWeekends, getPublicHolidays } from "../../services/holidaysApi";
import { getDailyForecastSummary, getForecastByCoordinates } from "../../services/weatherApi";
import { useSearchParams } from "../search/useSearchParams";
import type { DashboardModel } from "../../types/dashboard";
import { calculatePricingRecommendation, clampDailyRateChange, daysUntil, average } from "../../utils/priceUtils";
import type { HotelType, WeatherCategory } from "../../types/common";
import { getNextThirtyDays, toUtcIsoEnd, toUtcIsoStart } from "../../utils/dateUtils";
import type { LongWeekend } from "../../types/holidays";

function normalizeEventDate(rawDate: string) {
  if (rawDate.includes("T")) {
    return rawDate.slice(0, 10);
  }
  return rawDate;
}

function getTierFromHotelType(hotelType: HotelType): "budget" | "midscale" | "luxury" {
  if (hotelType === "business" || hotelType === "city") {
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

function longWeekendDates(longWeekends: LongWeekend[]) {
  const dates = new Set<string>();

  longWeekends.forEach((weekend) => {
    const days = eachDayOfInterval({
      start: parseISO(weekend.startDate),
      end: parseISO(weekend.endDate)
    });
    days.forEach((date) => dates.add(format(date, "yyyy-MM-dd")));
  });

  return dates;
}

export function useDashboardData() {
  const params = useSearchParams();

  const hotelsQuery = useQuery({
    queryKey: ["hotels", params.cityCode],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      try {
        const result = await getHotelsByCity({ cityCode: params.cityCode, radius: 12, radiusUnit: "KM" });
        return result.data;
      } catch {
        return [];
      }
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
      try {
        const result = await getHotelOffers({
          hotelIds,
          adults: params.adults,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          bestRateOnly: true
        });
        return result.data;
      } catch {
        return [];
      }
    }
  });

  const eventsQuery = useQuery({
    queryKey: ["events", params.latitude, params.longitude, params.checkInDate, params.checkOutDate],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        return await getEventsNearLocation({
          latitude: params.latitude,
          longitude: params.longitude,
          startDateTime: toUtcIsoStart(params.checkInDate),
          endDateTime: toUtcIsoEnd(params.checkOutDate),
          radius: 20,
          unit: "miles",
          size: 100,
          sort: "date,asc"
        });
      } catch {
        return { events: [], totalElements: 0 };
      }
    }
  });

  const holidaysQuery = useQuery({
    queryKey: ["holidays", params.countryCode, params.checkInDate, params.checkOutDate],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const years = new Set([
        parseISO(params.checkInDate).getFullYear(),
        parseISO(params.checkOutDate).getFullYear()
      ]);

      try {
        const requests = Array.from(years).map(async (year) => {
          const [publicHolidays, longWeekends] = await Promise.all([
            getPublicHolidays(year, params.countryCode),
            getLongWeekends(year, params.countryCode)
          ]);
          return { publicHolidays, longWeekends };
        });

        const yearsData = await Promise.all(requests);

        return {
          publicHolidays: yearsData.flatMap((entry) => entry.publicHolidays),
          longWeekends: yearsData.flatMap((entry) => entry.longWeekends)
        };
      } catch {
        return { publicHolidays: [], longWeekends: [] };
      }
    }
  });

  const weatherQuery = useQuery({
    queryKey: ["weather", params.latitude, params.longitude],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      try {
        const forecast = await getForecastByCoordinates(params.latitude, params.longitude);
        return getDailyForecastSummary(forecast);
      } catch {
        return [];
      }
    }
  });

  const model = useMemo<DashboardModel>(() => {
    const offerPrices = (offersQuery.data ?? []).flatMap((hotel) =>
      hotel.offers
        .map((offer) => Number(offer.price.variations?.average?.base ?? offer.price.total))
        .filter((price) => Number.isFinite(price))
    );

    const baseRate = offerPrices.length ? average(offerPrices) : 220;
    const dates = getNextThirtyDays(params.checkInDate);

    const eventMap = new Map<string, number>();
    const events = eventsQuery.data?.events ?? [];

    events.forEach((event) => {
      const key = normalizeEventDate(event.date);
      const score = 1 + Math.min(2.5, event.popularityScore / 120 + (event.maxPrice ?? 0) / 500);
      eventMap.set(key, Math.max(eventMap.get(key) ?? 1, score));
    });

    const weatherByDate = new Map<string, WeatherCategory>();
    (weatherQuery.data ?? []).forEach((day) => {
      weatherByDate.set(day.date, day.category);
    });

    const holidays = holidaysQuery.data?.publicHolidays ?? [];
    const longWeekends = holidaysQuery.data?.longWeekends ?? [];

    const holidayDates = new Set(
      holidays
        .filter((holiday) => holiday.types.includes("Public") || holiday.types.includes("Bank"))
        .map((holiday) => holiday.date)
    );

    const longWeekendDateSet = longWeekendDates(longWeekends);

    let previousRate = baseRate;
    const tier = getTierFromHotelType(params.hotelType);

    const pricing = dates.map((date) => {
      const recommendation = calculatePricingRecommendation({
        date,
        baseRate,
        occupancyRate: params.estimatedOccupancy,
        hotelType: params.hotelType,
        eventIntensity: eventMap.get(date) ?? 1,
        weatherCategory: weatherForDate(date, weatherByDate),
        isHoliday: holidayDates.has(date),
        isLongWeekend: longWeekendDateSet.has(date),
        daysUntilCheckIn: Math.max(0, daysUntil(date)),
        tier
      });

      const clampedRate = clampDailyRateChange(previousRate, recommendation.finalRate, 0.2);
      previousRate = clampedRate;

      return {
        ...recommendation,
        finalRate: clampedRate,
        finalMultiplier: clampedRate / recommendation.baseRate
      };
    });

    const adr = average(pricing.map((item) => item.finalRate));
    const occupancy = params.estimatedOccupancy;

    return {
      pricing,
      events,
      weather: weatherQuery.data ?? [],
      kpis: {
        adr,
        revpar: adr * (occupancy / 100),
        occupancy,
        activeMultiplier: pricing[0]?.finalMultiplier ?? 1
      }
    };
  }, [
    offersQuery.data,
    params.checkInDate,
    params.countryCode,
    params.estimatedOccupancy,
    params.hotelType,
    eventsQuery.data?.events,
    holidaysQuery.data?.longWeekends,
    holidaysQuery.data?.publicHolidays,
    weatherQuery.data
  ]);

  return {
    model,
    eventDates: new Set(model.events.map((event) => normalizeEventDate(event.date))),
    isLoading:
      hotelsQuery.isLoading || offersQuery.isLoading || eventsQuery.isLoading || holidaysQuery.isLoading || weatherQuery.isLoading,
    isFetching:
      hotelsQuery.isFetching || offersQuery.isFetching || eventsQuery.isFetching || holidaysQuery.isFetching || weatherQuery.isFetching
  };
}
