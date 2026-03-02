import { useSearchStore } from "../../store/useSearchStore";

export function useSearchParams() {
  const {
    cityName,
    cityCode,
    countryCode,
    latitude,
    longitude,
    searchToken,
    checkInDate,
    checkOutDate,
    adults,
    hotelType,
    estimatedOccupancy
  } = useSearchStore();

  return {
    cityName,
    cityCode,
    countryCode,
    latitude,
    longitude,
    searchToken,
    checkInDate,
    checkOutDate,
    adults,
    hotelType,
    estimatedOccupancy
  };
}
