export interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface AmadeusHotelReference {
  hotelId: string;
  name: string;
  iataCode: string;
  chainCode?: string;
  geoCode: {
    latitude: number;
    longitude: number;
  };
  address: {
    countryCode: string;
  };
}

export interface AmadeusHotelListResponse {
  data: AmadeusHotelReference[];
}

export interface AmadeusOfferPrice {
  currency: string;
  base: string;
  total: string;
  variations?: {
    average?: {
      base: string;
    };
    changes?: Array<{
      startDate: string;
      endDate: string;
      base: string;
    }>;
  };
}

export interface AmadeusHotelOffer {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  boardType?: string;
  room: {
    typeEstimated?: {
      category?: string;
      beds?: number;
      bedType?: string;
    };
    description?: {
      text?: string;
    };
  };
  price: AmadeusOfferPrice;
  policies?: {
    cancellation?: {
      type?: string;
    };
    paymentType?: string;
  };
}

export interface AmadeusHotelOffersItem {
  hotel: {
    hotelId: string;
    name: string;
    cityCode: string;
    latitude: number;
    longitude: number;
  };
  available: boolean;
  offers: AmadeusHotelOffer[];
}

export interface AmadeusHotelOffersResponse {
  data: AmadeusHotelOffersItem[];
}

export interface AmadeusHotelSentiment {
  hotelId: string;
  overallRating?: number;
  sleepQuality?: number;
  service?: number;
  facilities?: number;
  roomComforts?: number;
  valueForMoney?: number;
  catering?: number;
  location?: number;
  internet?: number;
  staff?: number;
  numberOfReviews?: number;
  numberOfRatings?: number;
}

export interface AmadeusHotelSentimentsResponse {
  data: AmadeusHotelSentiment[];
}
