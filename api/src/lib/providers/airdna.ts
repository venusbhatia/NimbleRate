import { config } from "../../config.js";
import type { ExternalProvider } from "../../types.js";
import { buildUrl, fetchJson, UpstreamError } from "../http.js";
import { getProviderCache, runProviderSerialized, setProviderCache } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";

const PROVIDER: ExternalProvider = "airdna";
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface AirDnaSupplySignal {
  source: "airdna" | "fallback_proxy";
  supplyPressureIndex: number;
  recommendedMultiplier: number;
  activeListingsEstimate: number;
  trend: "rising" | "falling" | "stable" | "unknown";
  trendPct?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pressureToMultiplier(index: number) {
  if (index >= 75) return 0.94;
  if (index >= 60) return 0.97;
  if (index >= 45) return 1;
  if (index >= 30) return 1.03;
  return 1.06;
}

function normalizeTrend(value: unknown): AirDnaSupplySignal["trend"] {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("rise") || normalized.includes("up")) return "rising";
  if (normalized.includes("fall") || normalized.includes("down")) return "falling";
  if (normalized.includes("stable") || normalized.includes("flat")) return "stable";
  return "unknown";
}

function normalizePayload(payload: unknown): AirDnaSupplySignal {
  const objectPayload = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const pressureCandidate =
    Number(objectPayload.supplyPressureIndex) ||
    Number(objectPayload.market_pressure_index) ||
    Number(objectPayload.pressure_index) ||
    Number(objectPayload.pressure) ||
    50;
  const listingsCandidate =
    Number(objectPayload.activeListingsEstimate) ||
    Number(objectPayload.active_listings) ||
    Number(objectPayload.listings) ||
    0;
  const trendPctCandidate =
    Number(objectPayload.trendPct) ||
    Number(objectPayload.trend_pct) ||
    Number(objectPayload.monthly_change_pct) ||
    0;

  const supplyPressureIndex = clamp(Math.round(pressureCandidate), 0, 100);
  const trend =
    objectPayload.trend !== undefined
      ? normalizeTrend(objectPayload.trend)
      : trendPctCandidate >= 4
        ? "rising"
        : trendPctCandidate <= -4
          ? "falling"
          : "stable";

  return {
    source: "airdna",
    supplyPressureIndex,
    recommendedMultiplier: Number(pressureToMultiplier(supplyPressureIndex).toFixed(2)),
    activeListingsEstimate: Math.max(0, Math.round(listingsCandidate)),
    trend,
    trendPct: Number(trendPctCandidate.toFixed(2))
  };
}

function getCacheKey(input: {
  cityName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  daysForward: number;
}) {
  return `airdna:${input.cityName.toLowerCase()}:${input.countryCode.toLowerCase()}:${input.latitude.toFixed(3)}:${input.longitude.toFixed(3)}:${input.daysForward}`;
}

export async function getAirDnaSupplySignal(input: {
  cityName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  daysForward: number;
}): Promise<AirDnaSupplySignal> {
  const apiKey = config.airdnaApiKey;
  if (!apiKey) {
    throw new UpstreamError("AirDNA provider not configured", 503, {
      provider: "airdna",
      code: "NOT_CONFIGURED"
    });
  }

  const cacheKey = getCacheKey(input);
  const cached = getProviderCache<AirDnaSupplySignal>(cacheKey);
  if (cached) {
    return cached;
  }

  return runProviderSerialized(PROVIDER, async () => {
    assertProviderBudget(PROVIDER);
    incrementProviderUsage(PROVIDER);

    const url = buildUrl(config.airdnaBaseUrl, "/v1/market/supply", {
      city: input.cityName,
      country: input.countryCode,
      lat: input.latitude,
      lon: input.longitude,
      days: input.daysForward
    });

    const payload = await fetchJson<unknown>(
      url,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "x-api-key": apiKey
        }
      },
      "AirDNA supply request failed"
    );

    const normalized = normalizePayload(payload);
    setProviderCache(cacheKey, normalized, CACHE_TTL_MS);
    return normalized;
  });
}
