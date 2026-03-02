export interface PredictHQEvent {
  id: string;
  title: string;
  category: string;
  start: string;
  end?: string;
  rank: number;
  predictedAttendance: number;
  predictedEventSpend: number;
  latitude: number;
  longitude: number;
  distanceKm: number;
  impactScore: number;
  labels: string[];
}

export interface PredictHQEventsResponse {
  events: PredictHQEvent[];
}
