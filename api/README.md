# API Workspace

This folder is reserved for backend and integration work (Amadeus, Ticketmaster, Nager.at, OpenWeather proxying).

## Purpose

- Keep API/proxy development separate from the UI app in root.
- Hide third-party API keys behind backend endpoints for production.
- Provide one integration surface for the frontend team.

## Suggested Next Step

Initialize backend stack here when ready (Express/Fastify/Hono):

```bash
cd api
pnpm install
```

Create local secrets file:

```bash
cp .env.example .env.local
```

Start API server:

```bash
pnpm dev
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

Then expose routes like:

- `GET /api/hotels/offers`
- `GET /api/events`
- `GET /api/holidays`
- `GET /api/weather`
