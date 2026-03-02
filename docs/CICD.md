# CI/CD Setup (Render + GitHub Actions)

This document describes the production CI/CD flow for NimbleRate.

## Pipeline Overview

## CI (`.github/workflows/ci.yml`)

- Triggers:
  - Push: `main`, `dev`, `feature/**`, `codex/**`
  - Pull request: `main`, `dev`
- Required checks:
  - `Frontend Lint, Test & Build`
  - `API Test & Build`
  - `Integration Smoke`

## CD (`.github/workflows/cd.yml`)

- Trigger: push to `main`
- Gate: GitHub Environment `production` (manual approval)
- Actions:
  - Trigger Render API deploy hook
  - Trigger Render frontend deploy hook
  - Poll production health checks and fail on timeout/non-200

## GitHub Requirements

## 1. Environment

Create environment: `production`

- Require reviewers for deployment approval.
- Keep deployment branch policy to `main` only.

## 2. Repository Secrets

Add these repository secrets:

- `RENDER_API_DEPLOY_HOOK_URL_PROD`
- `RENDER_WEB_DEPLOY_HOOK_URL_PROD`
- `PROD_API_HEALTHCHECK_URL`
- `PROD_WEB_HEALTHCHECK_URL`

Recommended values:

- `PROD_API_HEALTHCHECK_URL`: `https://<api-domain>/api/health`
- `PROD_WEB_HEALTHCHECK_URL`: `https://<frontend-domain>/`

## 3. Branch protection

Protect `main`:

- Require pull request before merge.
- Require conversation resolution before merge.
- Require status checks to pass:
  - `Frontend Lint, Test & Build`
  - `API Test & Build`
  - `Integration Smoke`
- Disable direct pushes.

Protect `dev` with the same required status checks.

## Render Setup

## API service (Web Service)

- Root directory: `api`
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Start command: `pnpm start`
- Environment variables:
  - `AMADEUS_API_KEY`
  - `AMADEUS_API_SECRET`
  - `TICKETMASTER_CONSUMER_KEY`
  - `OPENWEATHER_API_KEY`
  - `MAKCORPS_API_KEY` (optional for v2; preferred for live compset)
  - `MAKCORPS_USE_RAPIDAPI` + `MAKCORPS_RAPIDAPI_HOST` (only if using RapidAPI transport)
  - `MAKCORPS_USERNAME` + `MAKCORPS_PASSWORD` (legacy alternative to API key)
  - `PREDICTHQ_API_TOKEN` (optional for v2; required for PredictHQ primary events feed)
  - `SERPAPI_API_KEY` (optional; used when trends endpoint is enabled)
  - `MAKCORPS_DAILY_CALL_BUDGET` (recommended)
  - `PREDICTHQ_DAILY_CALL_BUDGET` (recommended)
  - `FRONTEND_ORIGIN=https://<frontend-domain>`
  - `RATE_LIMIT_ENABLED=true`
  - `RATE_LIMIT_WINDOW_MS=60000`
  - `RATE_LIMIT_MAX=120`

## Frontend service (Static Site)

- Root directory: repository root
- Build command: `pnpm install --frozen-lockfile && pnpm build`
- Publish directory: `dist`
- Environment variables:
  - `VITE_API_BASE_URL=https://<api-domain>`

## Deploy hooks

Generate one deploy hook per Render service and map them:

- API service hook -> `RENDER_API_DEPLOY_HOOK_URL_PROD`
- Frontend service hook -> `RENDER_WEB_DEPLOY_HOOK_URL_PROD`

## Validation Checklist

1. Push a PR to `dev` and confirm all three CI checks pass.
2. Merge to `main`.
3. Confirm `CD` starts and waits at `production` approval.
4. Approve deployment.
5. Confirm both services deploy and health checks pass in workflow logs.

## Troubleshooting

## CD fails with missing secret

- Symptom: `Missing required secret: ...`
- Fix: Add missing secret in GitHub repository settings.

## CD fails on health checks

- Symptom: `health check failed after ... attempts`
- Fix:
  - Verify Render service is healthy in Render dashboard.
  - Verify `PROD_API_HEALTHCHECK_URL` and `PROD_WEB_HEALTHCHECK_URL`.
  - Verify API `FRONTEND_ORIGIN` and frontend `VITE_API_BASE_URL`.

## CORS issues in production

- Symptom: frontend calls blocked by browser CORS policy.
- Fix:
  - Set API `FRONTEND_ORIGIN` exactly to frontend domain (including protocol).
  - Redeploy API service.
