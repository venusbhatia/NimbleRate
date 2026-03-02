export interface ApiErrorShape {
  message: string;
  status: number;
  details?: unknown;
}
