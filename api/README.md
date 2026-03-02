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
- `GET /api/market/analysis`

## Notes

- Frontend should call only backend `/api/*` routes (no direct provider keys in frontend).
- In local development, root `vite.config.ts` proxies `/api` to `http://localhost:8787`.
- Set `FRONTEND_ORIGIN=http://localhost:5173` in `api/.env.local` for local CORS.
- v2 provider integrations are optional at boot: missing Makcorps/PredictHQ keys return structured `NOT_CONFIGURED` errors for direct provider endpoints, while `/api/market/analysis` degrades gracefully with fallbacks and warnings.
- Makcorps auth supports:
  - `MAKCORPS_API_KEY` (preferred)
  - or `MAKCORPS_USERNAME` + `MAKCORPS_PASSWORD` (legacy token flow)
