export interface PacePoint {
  date: string;
  roomsBooked: number;
  roomsAvailable: number;
  occupancyRate: number;
  pickupLast7Days: number;
  occupancyLastYear: number;
}

export interface PaceSimulationResponse {
  totalRooms: number;
  daysForward: number;
  pace: PacePoint[];
}
