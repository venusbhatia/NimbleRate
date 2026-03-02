export interface CompsetOtaRate {
  ota: string;
  rate: number;
  currency: string;
}

export interface CompsetHotel {
  hotelId: string;
  hotelName: string;
  starRating?: number;
  reviewScore?: number;
  latitude?: number;
  longitude?: number;
  otaRates: CompsetOtaRate[];
  medianRate: number;
}

export interface CompsetSearchResponse {
  city: string;
  hotels: CompsetHotel[];
}

export interface CompsetRatesResponse {
  hotel: CompsetHotel | null;
}

export interface CompsetSummary {
  medianRate: number;
  averageRate: number;
  sampleSize: number;
}
