import { useSearchStore } from "../../store/useSearchStore";

export function useSearchParams() {
  const {
    cityCode,
    countryCode,
    latitude,
    longitude,
    checkInDate,
    checkOutDate,
    adults,
    hotelType,
    estimatedOccupancy
  } = useSearchStore();

  return {
    cityCode,
    countryCode,
    latitude,
    longitude,
    checkInDate,
    checkOutDate,
    adults,
    hotelType,
    estimatedOccupancy
  };
}
