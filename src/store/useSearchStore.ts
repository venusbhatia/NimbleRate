import { addDays, format } from "date-fns";
import { create } from "zustand";
import type { HotelType } from "../types/common";

interface SearchState {
  cityName: string;
  cityCode: string | null;
  countryCode: string;
  propertyId: string;
  latitude: number;
  longitude: number;
  searchToken: number;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  directRate: number;
  useSuggestedCompset: boolean;
  hotelType: HotelType;
  estimatedOccupancy: number;
  setCity: (payload: {
    cityName: string;
    cityCode: string | null;
    countryCode: string;
    latitude: number;
    longitude: number;
  }) => void;
  setDates: (checkInDate: string, checkOutDate: string) => void;
  setAdults: (adults: number) => void;
  setDirectRate: (directRate: number) => void;
  setUseSuggestedCompset: (useSuggestedCompset: boolean) => void;
  setPropertyId: (propertyId: string) => void;
  setHotelType: (hotelType: HotelType) => void;
  setEstimatedOccupancy: (estimatedOccupancy: number) => void;
  runAnalysis: () => void;
}

const now = new Date();
const defaultCheckInDate = format(addDays(now, 7), "yyyy-MM-dd");
const defaultCheckOutDate = format(addDays(now, 9), "yyyy-MM-dd");

export const useSearchStore = create<SearchState>((set) => ({
  cityName: "Austin",
  cityCode: "AUS",
  countryCode: "US",
  propertyId: "default",
  latitude: 30.2672,
  longitude: -97.7431,
  searchToken: 0,
  checkInDate: defaultCheckInDate,
  checkOutDate: defaultCheckOutDate,
  adults: 2,
  directRate: 229,
  useSuggestedCompset: false,
  hotelType: "city",
  estimatedOccupancy: 68,
  setCity: (payload) =>
    set({
      cityName: payload.cityName,
      cityCode: payload.cityCode,
      countryCode: payload.countryCode,
      latitude: payload.latitude,
      longitude: payload.longitude
    }),
  setDates: (checkInDate, checkOutDate) => set({ checkInDate, checkOutDate }),
  setAdults: (adults) => set({ adults }),
  setDirectRate: (directRate) => set({ directRate }),
  setUseSuggestedCompset: (useSuggestedCompset) => set({ useSuggestedCompset }),
  setPropertyId: (propertyId) =>
    set({
      propertyId: propertyId.trim().length ? propertyId.trim().slice(0, 64) : "default"
    }),
  setHotelType: (hotelType) => set({ hotelType }),
  setEstimatedOccupancy: (estimatedOccupancy) => set({ estimatedOccupancy }),
  runAnalysis: () => set((state) => ({ searchToken: state.searchToken + 1 }))
}));
