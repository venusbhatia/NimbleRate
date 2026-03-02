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
pnpm init
```

Create local secrets file:

```bash
cp .env.example .env.local
```

Then expose routes like:

- `GET /api/hotels/offers`
- `GET /api/events`
- `GET /api/holidays`
- `GET /api/weather`
