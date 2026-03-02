import { config } from "../../config.js";
import type { ExternalProvider } from "../../types.js";
import { buildUrl, fetchJson, UpstreamError } from "../http.js";
import { getProviderCache, runProviderSerialized, setProviderCache } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";

const PROVIDER: ExternalProvider = "predicthq";

export interface PredictHQEvent {
  id: string;
  title: string;
  category: string;
  start: string;
  end?: string;
  rank: number;
  predictedAttendance: number;
  predictedEventSpend: number;
  latitude: number;
  longitude: number;
  distanceKm: number;
  impactScore: number;
  labels: string[];
}

function isConfigured() {
  return Boolean(config.predictHqApiToken);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function distanceWeight(distanceKm: number) {
  if (distanceKm <= 1) return 1;
  if (distanceKm <= 3) return 0.75;
  if (distanceKm <= 5) return 0.5;
  if (distanceKm <= 10) return 0.25;
  return 0.1;
}

function computeImpactScore(rank: number, predictedAttendance: number, distanceKm: number) {
  const rankFactor = Math.min(1, Math.max(0, rank / 100));
  const attendanceFactor = Math.min(1, Math.max(0, predictedAttendance / 30000));
  const weighted = rankFactor * 0.65 + attendanceFactor * 0.35;
  return Math.round(weighted * 100 * distanceWeight(distanceKm));
}

function normalizeEvents(
  payload: unknown,
  originLatitude: number,
  originLongitude: number
): PredictHQEvent[] {
  const results =
    payload && typeof payload === "object" && Array.isArray((payload as { results?: unknown[] }).results)
      ? (payload as { results: unknown[] }).results
      : [];

  return results
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => {
      const point = Array.isArray(entry.location) ? entry.location : [];
      const longitude = toNumber(point[0]);
      const latitude = toNumber(point[1]);
      const distanceKm = haversineKm(originLatitude, originLongitude, latitude, longitude);
      const rank = toNumber(entry.rank);
      const predictedAttendance = toNumber(entry.phq_attendance);
      const predictedEventSpend = toNumber(entry.predicted_event_spend);

      return {
        id: String(entry.id ?? `${entry.title ?? "event"}-${entry.start ?? ""}`),
        title: String(entry.title ?? "Unnamed event"),
        category: String(entry.category ?? "unknown"),
        start: String(entry.start ?? ""),
        end: typeof entry.end === "string" ? entry.end : undefined,
        rank,
        predictedAttendance,
        predictedEventSpend,
        latitude,
        longitude,
        distanceKm: Math.round(distanceKm * 100) / 100,
        impactScore: computeImpactScore(rank, predictedAttendance, distanceKm),
        labels: Array.isArray(entry.labels) ? entry.labels.filter((label): label is string => typeof label === "string") : []
      };
    })
    .filter((entry) => Boolean(entry.start));
}

async function predicthqGet<T>(path: string, params: Record<string, string | number | boolean | undefined>) {
  if (!isConfigured()) {
    throw new UpstreamError("PredictHQ provider not configured", 503, {
      provider: PROVIDER,
      code: "NOT_CONFIGURED"
    });
  }

  const cacheKey = `predicthq:${path}:${JSON.stringify(params)}`;
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

    const url = buildUrl(config.predictHqBaseUrl, path, params);
    const payload = await fetchJson<T>(
      url,
      {
        headers: {
          Authorization: `Bearer ${config.predictHqApiToken}`
        }
      },
      "PredictHQ request failed"
    );

    setProviderCache(cacheKey, payload, 30 * 60 * 1000);
    return payload;
  });
}

export async function searchPredictHQEvents(params: {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  radiusKm?: number;
  rankGte?: number;
}) {
  const payload = await predicthqGet<unknown>("/events/", {
    "location_around.origin": `${params.latitude},${params.longitude}`,
    "location_around.offset": `${params.radiusKm ?? 5}km`,
    "start.gte": params.startDate,
    "start.lte": params.endDate,
    category: "concerts,conferences,sports,festivals,community",
    "rank.gte": params.rankGte ?? 50,
    sort: "rank"
  });

  return normalizeEvents(payload, params.latitude, params.longitude);
}
