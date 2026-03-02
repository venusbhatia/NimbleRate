import { config } from "../../config.js";
import type { ExternalProvider } from "../../types.js";
import { buildUrl, fetchJson, UpstreamError } from "../http.js";
import { getProviderCache, runProviderSerialized, setProviderCache } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";

const PROVIDER: ExternalProvider = "serpapi";

export interface TrendsSignal {
  current7dAvg: number;
  baseline28dAvg: number;
  momentumRatio: number;
  searchMomentumIndex: number;
  searchDemandMultiplier: number;
  source: "serpapi" | "fallback";
}

function isConfigured() {
  return Boolean(config.serpApiKey);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function normalizeTrendsValues(payload: unknown): number[] {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const interestOverTime =
    root.interest_over_time && typeof root.interest_over_time === "object"
      ? (root.interest_over_time as Record<string, unknown>)
      : {};

  const timelineRaw =
    (Array.isArray(interestOverTime.timeline_data) ? interestOverTime.timeline_data : undefined) ??
    (Array.isArray(root.timeline_data) ? root.timeline_data : []);

  const points = Array.isArray(timelineRaw) ? timelineRaw : [];
  const values: number[] = [];

  points.forEach((point) => {
    if (!point || typeof point !== "object") return;
    const row = point as Record<string, unknown>;
    const candidates: unknown[] = [];

    if (Array.isArray(row.values) && row.values.length > 0) {
      candidates.push(row.values[0]);
    }
    if (row.value !== undefined) candidates.push(row.value);

    candidates.forEach((candidate) => {
      if (candidate && typeof candidate === "object") {
        const obj = candidate as Record<string, unknown>;
        const extracted = toNumber(obj.extracted_value);
        const value = extracted ?? toNumber(obj.value);
        if (value !== null) values.push(value);
        return;
      }

      const numeric = toNumber(candidate);
      if (numeric !== null) values.push(numeric);
    });
  });

  return values.filter((value) => Number.isFinite(value) && value >= 0);
}

function ratioToMultiplier(ratio: number) {
  if (ratio >= 1.2) return 1.12;
  if (ratio >= 1.1) return 1.07;
  if (ratio >= 0.95) return 1;
  if (ratio >= 0.85) return 0.96;
  return 0.92;
}

export function normalizeTrendsSignal(payload: unknown): TrendsSignal {
  const values = normalizeTrendsValues(payload);
  if (!values.length) {
    return {
      current7dAvg: 0,
      baseline28dAvg: 0,
      momentumRatio: 1,
      searchMomentumIndex: 50,
      searchDemandMultiplier: 1,
      source: "fallback"
    };
  }

  const currentWindow = values.slice(-7);
  const baselineWindow = values.length > 7 ? values.slice(-35, -7) : values.slice(0, Math.max(1, values.length - 1));

  const current7dAvg = average(currentWindow);
  const baseline28dAvg = baselineWindow.length ? average(baselineWindow) : current7dAvg;
  const momentumRatio = current7dAvg / Math.max(1, baseline28dAvg);
  const searchMomentumIndex = clamp(Math.round(50 + (momentumRatio - 1) * 120), 0, 100);

  return {
    current7dAvg: Number(current7dAvg.toFixed(2)),
    baseline28dAvg: Number(baseline28dAvg.toFixed(2)),
    momentumRatio: Number(momentumRatio.toFixed(3)),
    searchMomentumIndex,
    searchDemandMultiplier: ratioToMultiplier(momentumRatio),
    source: "serpapi"
  };
}

async function serpapiGet<T>(params: Record<string, string | number | boolean | undefined>) {
  if (!isConfigured()) {
    throw new UpstreamError("SerpAPI provider not configured", 503, {
      provider: PROVIDER,
      code: "NOT_CONFIGURED"
    });
  }

  const cacheKey = `serpapi:${JSON.stringify(params)}`;
  const cached = getProviderCache<T>(cacheKey);
  if (cached) {
    return cached;
  }

  return runProviderSerialized(PROVIDER, async () => {
    const secondRead = getProviderCache<T>(cacheKey);
    if (secondRead) {
      return secondRead;
    }

    assertProviderBudget(PROVIDER);
    incrementProviderUsage(PROVIDER);

    const url = buildUrl(config.serpApiBaseUrl, "/search.json", {
      engine: "google_trends",
      api_key: config.serpApiKey,
      ...params
    });

    const payload = await fetchJson<T>(url, {}, "SerpAPI trends request failed");
    setProviderCache(cacheKey, payload, 60 * 60 * 1000);
    return payload;
  });
}

export async function getSerpApiTrendsSignal(params: {
  cityName: string;
  countryCode: string;
}) {
  const query = `hotels ${params.cityName} ${params.countryCode}`;
  const payload = await serpapiGet<unknown>({
    q: query,
    data_type: "TIMESERIES"
  });

  return normalizeTrendsSignal(payload);
}
