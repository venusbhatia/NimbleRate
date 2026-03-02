import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "*",
  amadeusBaseUrl: "https://test.api.amadeus.com",
  amadeusApiKey: required("AMADEUS_API_KEY"),
  amadeusApiSecret: required("AMADEUS_API_SECRET"),
  ticketmasterApiKey: required("TICKETMASTER_CONSUMER_KEY"),
  openWeatherApiKey: required("OPENWEATHER_API_KEY"),
  nagerBaseUrl: "https://date.nager.at/api/v3"
};
