# NimbleRate Integration Status Log

Last updated: `2026-03-01 22:47:38 EST`  
Branch: `codex/integrate`

## Runtime status snapshot

Backend base URL: `http://localhost:8787`  
Frontend base URL: `http://localhost:5174`

### Backend route checks (live)

| Route | Status | Result |
|---|---:|---:|
| `/api/health` | 200 | `status=ok` |
| `/api/hotels/by-city?cityCode=NYC&radius=10&radiusUnit=KM` | 200 | `309 hotels` |
| `/api/hotels/offers?...` | 200 | `1 hotel with offers` |
| `/api/events?...` | 200 | `20 events` |
| `/api/holidays/public?year=2026&countryCode=US` | 200 | `16 holidays` |
| `/api/holidays/long-weekends?year=2026&countryCode=US` | 200 | `9 long weekends` |
| `/api/weather/forecast?...` | 200 | `40 forecast points` |
| `/api/weather/geocode?q=New York,US&limit=1` | 200 | `1 result` |

Sample IDs used for offer validation: `YXNYCXXX,ALNYC647,XTNYC130`

### Frontend proxy checks (live)

| Route through frontend | Status | Result |
|---|---:|---:|
| `/api/health` via `5174` | 200 | `status=ok` |
| `/api/events?...` via `5174` | 200 | `5 events` |
| `/api/weather/forecast?...` via `5174` | 200 | `40 forecast points` |

Interpretation: frontend `/api/*` proxy is correctly forwarding to backend.

## What is real API data vs what is derived/fallback

### Real API-backed data (production-style, not mock)

1. Amadeus:
   - `/api/hotels/by-city`
   - `/api/hotels/by-geocode`
   - `/api/hotels/offers`
   - `/api/hotels/offers/:offerId`
   - `/api/hotels/sentiments`
   - `/api/hotels/autocomplete`
2. Ticketmaster:
   - `/api/events`
3. Nager.at:
   - `/api/holidays/public`
   - `/api/holidays/long-weekends`
   - `/api/holidays/countries`
4. OpenWeather:
   - `/api/weather/forecast`
   - `/api/weather/geocode`

All frontend service modules call backend `/api/*` endpoints via `apiPath(...)`:
- `src/services/amadeusApi.ts`
- `src/services/eventsApi.ts`
- `src/services/holidaysApi.ts`
- `src/services/weatherApi.ts`

### Derived (computed) data in frontend

1. Pricing recommendations for 30 days:
   - Built from multiplier engine in `src/utils/priceUtils.ts`.
   - Uses upstream signals (offers/events/weather/holidays) when available.
2. KPI values:
   - Calculated from derived pricing and occupancy in `src/features/dashboard/useDashboardData.ts`.

### Fallback behavior (not mock fixtures, but default runtime fallbacks)

1. If any query fails, app degrades gracefully:
   - Hotels/offers/events/weather/holidays fall back to empty collections.
2. If no offer prices are available:
   - `baseRate` defaults to `220` in `src/features/dashboard/useDashboardData.ts`.
3. Weather category fallback:
   - Defaults to `"cloudy"` for missing day mapping.
4. KPI badge deltas are currently static UI strings (not live-calculated):
   - `+8.4%`, `+5.1%`, `-1.2%`, `+0.12`
   - Defined in `src/features/pricing/KPICards.tsx`.

## Working / Not working / Unknown

### Working now

1. Backend integrations respond with live data for all core providers.
2. Frontend proxy to backend works.
3. Data-shape regression for stringified Amadeus payload is fixed and covered by tests in `api/src/lib/http.test.ts`.

### Not observed as broken

1. No evidence of direct provider calls from frontend service layer.
2. No evidence of mock fixture payloads used at runtime for dashboard data.

### Still requires manual browser confirmation

1. Visual correctness of all widgets in the open dashboard session.
2. Browser console/network noise check (repeated 4xx/5xx bursts).
3. UX behavior while changing search params (refresh + no crash).

