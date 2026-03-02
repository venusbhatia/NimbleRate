# API Workspace

Express proxy/API workspace for Amadeus, Makcorps, PredictHQ/Ticketmaster fallback, Nager.at, and OpenWeather integrations.

## Quick Start

1. Install dependencies:

```bash
pnpm --dir api install
```

2. Create local secrets:

```bash
cp api/.env.example api/.env.local
```

3. Run API in development:

```bash
pnpm dev:api
```

4. Run API checks:

```bash
pnpm --dir api test
pnpm --dir api build
```

## Current Routes

- `GET /api/health`
- `GET /api/hotels/by-city`
- `GET /api/hotels/by-geocode`
- `GET /api/hotels/offers`
- `GET /api/hotels/offers/:offerId`
- `GET /api/hotels/sentiments`
- `GET /api/hotels/autocomplete`
- `GET /api/events`
- `GET /api/holidays/public`
- `GET /api/holidays/long-weekends`
- `GET /api/holidays/countries`
- `GET /api/weather/forecast`
- `GET /api/weather/geocode`
- `GET /api/compset/search`
- `GET /api/compset/rates`
- `GET /api/providers/makcorps/diagnostics`
- `GET /api/events/predicthq`
- `POST /api/pace/simulate`
- `GET /api/usage/summary`
- `GET /api/market/history`
- `GET /api/parity/summary`
- `GET /api/market/analysis`

## Notes

- Frontend should call only backend `/api/*` routes (no direct provider keys in frontend).
- In local development, root `vite.config.ts` proxies `/api` to `http://localhost:8787`.
- Set `FRONTEND_ORIGIN=http://localhost:5173` in `api/.env.local` for local CORS.
- Optional DB override: set `NIMBLERATE_DB_PATH` to store SQLite outside default `api/data/nimblerate.db`.
- v2 provider integrations are optional at boot: missing keys return structured `NOT_CONFIGURED` errors for direct provider endpoints, while `/api/market/analysis` degrades gracefully with fallbacks and warnings.
- Makcorps auth is API-key-first:
  - Preferred: `MAKCORPS_API_KEY`
  - Optional fallback: `MAKCORPS_USERNAME` + `MAKCORPS_PASSWORD` (legacy token flow)
  - Optional transport switch: `MAKCORPS_USE_RAPIDAPI=true` when your key is provisioned through RapidAPI
- Phase-2 Wave-1 demand-intent providers:
  - `SERPAPI_API_KEY` (Google Trends demand momentum)
  - `AMADEUS_FLIGHTS_DAILY_CALL_BUDGET` (flight-demand usage guardrail)
  - `PMS_PROVIDER=simulated|cloudbeds` (default `simulated`)
  - `CLOUDBEDS_API_KEY`, `CLOUDBEDS_PROPERTY_ID` (Cloudbeds scaffold mode)
- `/api/market/analysis` includes:
  - `analysisContext` (run metadata)
  - `fallbacksUsed` (machine-readable fallback flags)
  - `sourceHealth` (Hotels, Events, Holidays, Weather, Trends, Flights, PMS, University)
  - `explainabilityByDate` (per-day factor contribution + guardrail details)
- `/api/market/history` and `/api/parity/summary` are SQLite-backed and do not call external providers.
- `ANALYSIS_REQUIRED` (HTTP 409 + `details.code`) means requested market/date data does not exist yet; run analysis first.
- New fallback flags in phase2_wave1:
  - `trends_fallback_neutral`
  - `flight_demand_fallback_neutral`
  - `pms_fallback_simulated`
  - `university_fallback_none`
