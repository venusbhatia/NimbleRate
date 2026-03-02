# NimbleRate

Zero-touch, hyper-local dynamic pricing that moves as fast as the market.

## Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS 4
- TanStack Query 5 for API/server state
- Zustand 5 for local UI/search state
- Recharts 3 for charts

## Quick Start

1. Install dependencies:

```bash
pnpm install
pnpm --dir api install
```

2. Add environment variables:

```bash
cp .env.example .env.local
cp api/.env.example api/.env.local
```

Set this if API is on a non-default host:

- `VITE_API_BASE_URL` (optional; defaults to same-origin `/api` with Vite proxy)

Set secrets in `api/.env.local`:

- `AMADEUS_API_KEY`
- `AMADEUS_API_SECRET`
- `TICKETMASTER_CONSUMER_KEY`
- `OPENWEATHER_API_KEY`
- Optional v2 providers:
  - `MAKCORPS_API_KEY` (preferred)
  - `MAKCORPS_USE_RAPIDAPI` + `MAKCORPS_RAPIDAPI_HOST` (only if your Makcorps key requires RapidAPI transport)
  - `MAKCORPS_RAPIDAPI_BASE_URL` (optional override)
  - `MAKCORPS_USERNAME` + `MAKCORPS_PASSWORD` (optional legacy auth fallback)
  - `PREDICTHQ_API_TOKEN`
  - `SERPAPI_API_KEY`
  - `PMS_PROVIDER=simulated|cloudbeds` (default `simulated`)
  - `CLOUDBEDS_API_KEY`, `CLOUDBEDS_PROPERTY_ID` (only when `PMS_PROVIDER=cloudbeds`)

3. Start dev server:

```bash
pnpm dev
```

4. In a second terminal, start API:

```bash
pnpm dev:api
```

5. Run checks:

```bash
pnpm lint
pnpm test
pnpm build
pnpm --dir api test
pnpm --dir api build
```

## Team Workflow

- Stable branch: `main`
- Integration branch: `dev`
- Working branches: `feature/*` created from `dev`
- Temporary CI-supported engineering branches: `codex/*`

Detailed workflow: `docs/BRANCHING.md`

## CI/CD

- `CI` runs on pushes to `main`, `dev`, `feature/**`, and `codex/**`, plus PRs to `main`/`dev`.
- Required CI checks:
  - `Frontend Lint, Test & Build`
  - `API Test & Build`
  - `Integration Smoke`
- `CD` runs on push to `main`, then waits for manual approval in GitHub `production` environment.
- After approval, CD triggers Render deploy hooks for API + frontend and verifies health checks.

Setup guide: `docs/CICD.md`

## Architecture

```text
/
├── src/                # UI app (Vite + React)
├── api/                # Backend/API integration workspace
└── docs/

src/
├── components/ui
├── components/layout
├── components/charts
├── features/search
├── features/pricing
├── features/events
├── features/weather
├── features/dashboard
├── hooks
├── services
├── store
├── types
├── utils
└── pages
```

## Pricing Engine

`finalPrice = baseRate × occupancy × dayOfWeek × seasonality × events × weather × holiday × leadTime`

- Log dampening above 2.5x
- Tier caps: budget 2.5x, midscale 3x, luxury 4.5x
- Daily change guardrails: +/-20%

## v2 Analysis Flow

- Dashboard calls `/api/market/analysis` as the primary integration route.
- External provider calls are made only when the user clicks `Run Analysis`.
- `/api/usage/summary` powers provider call counters and quota warnings in Settings.
- Demo defaults are Austin-first (`AUS`, US) while global city search remains enabled.
- `/api/market/analysis` returns `analysisContext`, `fallbacksUsed`, `sourceHealth`, and `explainabilityByDate` for per-date explainability UI.
- Phase-2 Wave-1 active signals:
  - Search demand (SerpAPI trends)
  - Travel intent (Amadeus flight demand)
  - PMS pace mode (`simulated` by default, Cloudbeds scaffold fallback)
  - Curated university demand calendar

## Notes

- Frontend now uses backend proxy routes under `/api`.
- Keep secrets only in `api/.env.local`.
- Fallback matrix in `/api/market/analysis`:
  - `trends_fallback_neutral`
  - `flight_demand_fallback_neutral`
  - `pms_fallback_simulated`
  - `university_fallback_none`
