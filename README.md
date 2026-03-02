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
```

2. Add environment variables:

```bash
cp .env.example .env.local
```

Set these keys in `.env.local`:

- `VITE_AMADEUS_API_KEY`
- `VITE_AMADEUS_API_SECRET`
- `VITE_TICKETMASTER_API_KEY`
- `VITE_OPENWEATHER_API_KEY`

3. Start dev server:

```bash
pnpm dev
```

## Architecture

```text
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

- API calls are currently direct from frontend for fast prototyping.
- For production, proxy API keys through a backend service.
