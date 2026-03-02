export interface TicketmasterEvent {
  id: string;
  name: string;
  date: string;
  status: string;
  segment?: string;
  genre?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  popularityScore: number;
}

export interface TicketmasterEventsPage {
  events: TicketmasterEvent[];
  totalElements: number;
}

export interface TicketmasterRawEvent {
  id: string;
  name: string;
  dates?: {
    start?: {
      localDate?: string;
      dateTime?: string;
    };
    status?: {
      code?: string;
    };
  };
  classifications?: Array<{
    segment?: {
      name?: string;
    };
    genre?: {
      name?: string;
    };
  }>;
  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      location?: {
        latitude?: string;
        longitude?: string;
      };
    }>;
    attractions?: Array<{
      upcomingEvents?: {
        _total?: number;
      };
    }>;
  };
}

export interface TicketmasterDiscoveryResponse {
  _embedded?: {
    events?: TicketmasterRawEvent[];
  };
  page?: {
    totalElements?: number;
  };
}
