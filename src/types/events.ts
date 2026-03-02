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
