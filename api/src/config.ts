import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function optionalBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return raw === "true";
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "*",
  amadeusBaseUrl: "https://test.api.amadeus.com",
  amadeusApiKey: required("AMADEUS_API_KEY"),
  amadeusApiSecret: required("AMADEUS_API_SECRET"),
  ticketmasterApiKey: required("TICKETMASTER_CONSUMER_KEY"),
  openWeatherApiKey: required("OPENWEATHER_API_KEY"),
  nagerBaseUrl: "https://date.nager.at/api/v3",
  rateLimitEnabled: optionalBoolean("RATE_LIMIT_ENABLED", true),
  rateLimitWindowMs: optionalNumber("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitMax: optionalNumber("RATE_LIMIT_MAX", 120)
};
