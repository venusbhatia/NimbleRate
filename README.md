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

Detailed workflow: `docs/BRANCHING.md`

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

## Notes

- Frontend now uses backend proxy routes under `/api`.
- Keep secrets only in `api/.env.local`.
