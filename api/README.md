# API Workspace

Express proxy/API workspace for Amadeus, Ticketmaster, Nager.at, and OpenWeather integrations.

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

## Notes

- Frontend should call only backend `/api/*` routes (no direct provider keys in frontend).
- In local development, root `vite.config.ts` proxies `/api` to `http://localhost:8787`.
- Set `FRONTEND_ORIGIN=http://localhost:5173` in `api/.env.local` for local CORS.
