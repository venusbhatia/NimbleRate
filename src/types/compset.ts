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

export interface CompsetSuggestion {
  hotelId: string;
  hotelName: string;
  score: number;
  confidence: "high" | "medium" | "low";
  distanceKm: number | null;
  features: {
    geodistance: number;
    rateBand: number;
    demandSimilarity: number;
  };
  explanation: string;
}

export interface CompsetSuggestionsResponse {
  version: string;
  propertyId: string;
  propertyName: string;
  marketKey: string;
  generatedAt: string;
  suggestions: CompsetSuggestion[];
}
