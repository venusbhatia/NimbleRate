import { useSearchStore } from "../../store/useSearchStore";

export function useSearchParams() {
  const {
    cityName,
    cityCode,
    countryCode,
    propertyId,
    latitude,
    longitude,
    searchToken,
    checkInDate,
    checkOutDate,
    adults,
    directRate,
    useSuggestedCompset,
    hotelType,
    estimatedOccupancy
  } = useSearchStore();

  return {
    cityName,
    cityCode,
    countryCode,
    propertyId,
    latitude,
    longitude,
    searchToken,
    checkInDate,
    checkOutDate,
    adults,
    directRate,
    useSuggestedCompset,
    hotelType,
    estimatedOccupancy
  };
}
