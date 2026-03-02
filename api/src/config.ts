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

function optionalString(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return undefined;
  }
  return raw;
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
  makcorpsBaseUrl: process.env.MAKCORPS_BASE_URL ?? "https://api.makcorps.com",
  makcorpsApiKey: optionalString("MAKCORPS_API_KEY"),
  makcorpsUsername: optionalString("MAKCORPS_USERNAME"),
  makcorpsPassword: optionalString("MAKCORPS_PASSWORD"),
  makcorpsUseRapidApi: optionalBoolean("MAKCORPS_USE_RAPIDAPI", false),
  makcorpsRapidApiHost: optionalString("MAKCORPS_RAPIDAPI_HOST"),
  makcorpsRapidApiBaseUrl:
    process.env.MAKCORPS_RAPIDAPI_BASE_URL ?? "https://makcorps-hotel-price-comparison.p.rapidapi.com",
  makcorpsDailyCallBudget: optionalNumber("MAKCORPS_DAILY_CALL_BUDGET", 25),
  predictHqBaseUrl: process.env.PREDICTHQ_BASE_URL ?? "https://api.predicthq.com/v1",
  predictHqApiToken: optionalString("PREDICTHQ_API_TOKEN"),
  predictHqDailyCallBudget: optionalNumber("PREDICTHQ_DAILY_CALL_BUDGET", 100),
  serpApiKey: optionalString("SERPAPI_API_KEY"),
  serpApiBaseUrl: process.env.SERPAPI_BASE_URL ?? "https://serpapi.com",
  serpApiDailyCallBudget: optionalNumber("SERPAPI_DAILY_CALL_BUDGET", 100),
  amadeusFlightsDailyCallBudget: optionalNumber("AMADEUS_FLIGHTS_DAILY_CALL_BUDGET", 200),
  pmsProvider: (process.env.PMS_PROVIDER === "cloudbeds" ? "cloudbeds" : "simulated") as "simulated" | "cloudbeds",
  cloudbedsApiKey: optionalString("CLOUDBEDS_API_KEY"),
  cloudbedsPropertyId: optionalString("CLOUDBEDS_PROPERTY_ID"),
  cloudbedsBaseUrl: process.env.CLOUDBEDS_BASE_URL ?? "https://hotels.cloudbeds.com/api/v1.1",
  demoCity: process.env.DEMO_CITY ?? "Austin",
  demoLatitude: Number(process.env.DEMO_LAT ?? 30.2672),
  demoLongitude: Number(process.env.DEMO_LON ?? -97.7431),
  demoCountryCode: process.env.DEMO_COUNTRY ?? "US",
  analysisDaysForward: optionalNumber("ANALYSIS_DAYS_FORWARD", 30),
  nagerBaseUrl: "https://date.nager.at/api/v3",
  rateLimitEnabled: optionalBoolean("RATE_LIMIT_ENABLED", true),
  rateLimitWindowMs: optionalNumber("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitMax: optionalNumber("RATE_LIMIT_MAX", 120)
};
