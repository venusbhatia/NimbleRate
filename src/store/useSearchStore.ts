import { addDays, format } from "date-fns";
import { create } from "zustand";
import type { HotelType } from "../types/common";

interface SearchState {
  cityCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  hotelType: HotelType;
  estimatedOccupancy: number;
  setCity: (payload: {
    cityCode: string;
    countryCode: string;
    latitude: number;
    longitude: number;
  }) => void;
  setDates: (checkInDate: string, checkOutDate: string) => void;
  setAdults: (adults: number) => void;
  setHotelType: (hotelType: HotelType) => void;
  setEstimatedOccupancy: (estimatedOccupancy: number) => void;
}

const now = new Date();
const defaultCheckInDate = format(addDays(now, 7), "yyyy-MM-dd");
const defaultCheckOutDate = format(addDays(now, 9), "yyyy-MM-dd");

export const useSearchStore = create<SearchState>((set) => ({
  cityCode: "NYC",
  countryCode: "US",
  latitude: 40.7128,
  longitude: -74.006,
  checkInDate: defaultCheckInDate,
  checkOutDate: defaultCheckOutDate,
  adults: 2,
  hotelType: "city",
  estimatedOccupancy: 68,
  setCity: (payload) =>
    set({
      cityCode: payload.cityCode,
      countryCode: payload.countryCode,
      latitude: payload.latitude,
      longitude: payload.longitude
    }),
  setDates: (checkInDate, checkOutDate) => set({ checkInDate, checkOutDate }),
  setAdults: (adults) => set({ adults }),
  setHotelType: (hotelType) => set({ hotelType }),
  setEstimatedOccupancy: (estimatedOccupancy) => set({ estimatedOccupancy })
}));
