declare module "ngeohash" {
  export function encode(latitude: number, longitude: number, precision?: number): string;
}
