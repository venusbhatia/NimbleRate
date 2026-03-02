export interface LocationOption {
  id: string;
  cityName: string;
  countryCode: string;
  state?: string;
  latitude: number;
  longitude: number;
  cityCode: string | null;
  label: string;
}
