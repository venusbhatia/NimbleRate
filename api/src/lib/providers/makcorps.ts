import { config } from "../../config.js";
import type { ExternalProvider } from "../../types.js";
import { buildUrl, fetchJson, UpstreamError } from "../http.js";
import { getProviderCache, runProviderSerialized, setProviderCache } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";

const PROVIDER: ExternalProvider = "makcorps";
const AUTH_CACHE_KEY = "makcorps:auth-token";
const RAPIDAPI_DEFAULT_HOST = "makcorps-hotel-price-comparison.p.rapidapi.com";
const FALLBACK_ERROR_PATTERNS = [
  "Cannot GET /city/",
  "Cannot GET /hotel",
  "Endpoint not found",
  "Invalid API key",
  "Unauthorized"
];

export interface MakcorpsOtaRate {
  ota: string;
  rate: number;
  currency: string;
}

export interface MakcorpsCompsetHotel {
  hotelId: string;
  hotelName: string;
  starRating?: number;
  reviewScore?: number;
  latitude?: number;
  longitude?: number;
  otaRates: MakcorpsOtaRate[];
  medianRate: number;
}

export interface MakcorpsDiagnosticAttempt {
  profile: "direct_query" | "rapidapi" | "oauth";
  step:
    | "mapping_name"
    | "city_cityid"
    | "legacy_city_path"
    | "legacy_city_query"
    | "mapping_cityid_missing"
    | "auth_token";
  requestUrl: string;
  ok: boolean;
  status: number;
  normalizedHotelCount?: number;
  message?: string;
  detailsPreview?: string;
}

export interface MakcorpsDiagnosticsReport {
  configured: boolean;
  configSnapshot: {
    hasApiKey: boolean;
    hasUsernamePassword: boolean;
    useRapidApiFlag: boolean;
    baseUrl: string;
    rapidApiBaseUrl: string;
  };
  attempts: MakcorpsDiagnosticAttempt[];
  recommendedMode: "direct_query" | "rapidapi" | "oauth" | "none";
  recommendation: string;
}

function isConfigured() {
  return Boolean(config.makcorpsApiKey || (config.makcorpsUsername && config.makcorpsPassword));
}

function shouldUseRapidApiTransport() {
  return Boolean(config.makcorpsUseRapidApi);
}

function shouldRetryWithRapidApi(error: unknown) {
  if (!(error instanceof UpstreamError)) {
    return false;
  }

  if (![401, 403, 404].includes(error.status)) {
    return false;
  }

  const rawDetails = typeof error.details === "string" ? error.details : JSON.stringify(error.details ?? "");
  return FALLBACK_ERROR_PATTERNS.some((pattern) => rawDetails.includes(pattern));
}

function isRouteNotFound(error: unknown) {
  if (!(error instanceof UpstreamError)) {
    return false;
  }

  if (error.status !== 404) {
    return false;
  }

  const rawDetails = typeof error.details === "string" ? error.details : JSON.stringify(error.details ?? "");
  return rawDetails.includes("Cannot GET");
}

function buildApiKeyAuth(
  forceRapidApi = false
): { headers: Record<string, string>; query: Record<string, string>; baseUrl: string } | null {
  if (!config.makcorpsApiKey) {
    return null;
  }

  if (forceRapidApi || shouldUseRapidApiTransport()) {
    const headers: Record<string, string> = {
      "x-rapidapi-key": config.makcorpsApiKey,
      "x-rapidapi-host": config.makcorpsRapidApiHost ?? RAPIDAPI_DEFAULT_HOST
    };

    return {
      headers,
      query: {},
      baseUrl: config.makcorpsRapidApiBaseUrl
    };
  }

  const headers: Record<string, string> = {};
  const query: Record<string, string> = {
    api_key: config.makcorpsApiKey
  };

  return {
    headers,
    query,
    baseUrl: config.makcorpsBaseUrl
  };
}

type DiagnosticProfile = {
  mode: "direct_query" | "rapidapi" | "oauth";
  baseUrl: string;
  headers: Record<string, string>;
  query: Record<string, string>;
};

function redactUrl(url: string) {
  return url
    .replace(/([?&]api_key=)[^&]*/gi, "$1<redacted>")
    .replace(/([?&]apikey=)[^&]*/gi, "$1<redacted>");
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.length > 0) {
      return trimmed.slice(0, 160);
    }
  }

  return `Request failed: ${status}`;
}

function previewDetails(payload: unknown) {
  if (payload === null || payload === undefined) {
    return undefined;
  }

  if (typeof payload === "string") {
    return payload.slice(0, 220);
  }

  try {
    return JSON.stringify(payload).slice(0, 220);
  } catch {
    return String(payload).slice(0, 220);
  }
}

async function runDiagnosticRequest(
  profile: DiagnosticProfile,
  step: MakcorpsDiagnosticAttempt["step"],
  path: string,
  params: Record<string, string | number | boolean | undefined>
) {
  const url = buildUrl(profile.baseUrl, path, {
    ...params,
    ...profile.query
  });
  const redactedUrl = redactUrl(url);

  try {
    assertProviderBudget(PROVIDER);
    incrementProviderUsage(PROVIDER);

    const response = await fetch(url, {
      headers: profile.headers
    });
    const bodyText = await response.text();
    const parsed = safeJsonParse(bodyText);

    const attempt: MakcorpsDiagnosticAttempt = {
      profile: profile.mode,
      step,
      requestUrl: redactedUrl,
      ok: response.ok,
      status: response.status,
      normalizedHotelCount: response.ok ? normalizeCompsetPayload(parsed).length : undefined,
      message: response.ok ? "ok" : extractMessage(parsed, response.status),
      detailsPreview: response.ok ? undefined : previewDetails(parsed)
    };

    return {
      attempt,
      payload: parsed
    };
  } catch (error) {
    const upstream = error instanceof UpstreamError ? error : null;

    return {
      attempt: {
        profile: profile.mode,
        step,
        requestUrl: redactedUrl,
        ok: false,
        status: upstream?.status ?? 500,
        message: upstream?.message ?? (error instanceof Error ? error.message : "Unknown error"),
        detailsPreview: previewDetails(upstream?.details ?? error)
      } satisfies MakcorpsDiagnosticAttempt,
      payload: null as unknown
    };
  }
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.]/g, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function extractOtaRates(payload: Record<string, unknown>): MakcorpsOtaRate[] {
  const rates: MakcorpsOtaRate[] = [];
  const containerCandidates = [payload.ota_prices, payload.prices, payload.rates];

  containerCandidates.forEach((container) => {
    if (!container || typeof container !== "object") return;
    Object.entries(container as Record<string, unknown>).forEach(([key, raw]) => {
      const numeric = parseNumeric(raw);
      if (numeric === null) return;
      rates.push({ ota: key, rate: numeric, currency: "USD" });
    });
  });

  const directCandidates = ["booking", "booking_com", "expedia", "hotels_com", "agoda", "priceline"];
  directCandidates.forEach((candidate) => {
    const numeric = parseNumeric(payload[candidate]);
    if (numeric === null) return;
    rates.push({ ota: candidate, rate: numeric, currency: "USD" });
  });

  return rates;
}

function normalizeHotel(raw: Record<string, unknown>, index: number): MakcorpsCompsetHotel | null {
  const hotelNameCandidate =
    (typeof raw.hotel_name === "string" && raw.hotel_name) ||
    (typeof raw.name === "string" && raw.name) ||
    (typeof raw.hotelName === "string" && raw.hotelName);

  if (!hotelNameCandidate) {
    return null;
  }

  const hotelId =
    (typeof raw.hotelid === "string" && raw.hotelid) ||
    (typeof raw.id === "string" && raw.id) ||
    (typeof raw.hotelId === "string" && raw.hotelId) ||
    `mkc-${index}`;

  const otaRates = extractOtaRates(raw);
  const medianRate = median(otaRates.map((entry) => entry.rate));

  return {
    hotelId,
    hotelName: hotelNameCandidate,
    starRating: parseNumeric(raw.star_rating ?? raw.stars ?? raw.rating) ?? undefined,
    reviewScore: parseNumeric(raw.review_score ?? raw.reviewScore ?? raw.score) ?? undefined,
    latitude: parseNumeric(raw.latitude ?? raw.lat) ?? undefined,
    longitude: parseNumeric(raw.longitude ?? raw.lon ?? raw.lng) ?? undefined,
    otaRates,
    medianRate
  };
}

function normalizeCompsetPayload(payload: unknown): MakcorpsCompsetHotel[] {
  const arr =
    Array.isArray(payload) ? payload :
      payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown[] }).data) ? (payload as { data: unknown[] }).data :
        payload && typeof payload === "object" && Array.isArray((payload as { hotels?: unknown[] }).hotels) ? (payload as { hotels: unknown[] }).hotels :
          [];

  return arr
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => normalizeHotel(item, index))
    .filter((item): item is MakcorpsCompsetHotel => Boolean(item));
}

function extractCityIdFromMapping(payload: unknown): string | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  const rows = payload.filter(
    (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object"
  );
  const geoMatch =
    rows.find(
      (entry) =>
        String(entry.type ?? "").toUpperCase() === "GEO" &&
        (typeof entry.document_id === "string" || typeof entry.document_id === "number")
    ) ??
    rows.find((entry) => typeof entry.document_id === "string" || typeof entry.document_id === "number");

  if (!geoMatch) {
    return null;
  }

  return String(geoMatch.document_id);
}

async function getAuthToken() {
  const cached = getProviderCache<string>(AUTH_CACHE_KEY);
  if (cached) {
    return cached;
  }

  if (!isConfigured()) {
    throw new UpstreamError("Makcorps provider not configured", 503, {
      provider: PROVIDER,
      code: "NOT_CONFIGURED"
    });
  }

  const payload = await fetchJson<{ token?: string; access_token?: string }>(
    `${config.makcorpsBaseUrl}/auth`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: config.makcorpsUsername,
        password: config.makcorpsPassword
      })
    },
    "Makcorps auth failed"
  );

  const token = payload.token ?? payload.access_token;
  if (!token) {
    throw new UpstreamError("Makcorps auth token missing in response", 502, payload);
  }

  setProviderCache(AUTH_CACHE_KEY, token, 25 * 60 * 1000);
  return token;
}

async function makcorpsGet<T>(path: string, params: Record<string, string | number | boolean | undefined>) {
  const cacheKey = `makcorps:${path}:${JSON.stringify(params)}`;
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

    const apiKeyAuth = buildApiKeyAuth(false);
    const token = apiKeyAuth ? null : await getAuthToken();
    const url = buildUrl(apiKeyAuth?.baseUrl ?? config.makcorpsBaseUrl, path, {
      ...params,
      ...(apiKeyAuth?.query ?? {})
    });

    const requestHeaders: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(apiKeyAuth?.headers ?? {})
    };

    let payload: T;

    try {
      payload = await fetchJson<T>(
        url,
        {
          headers: requestHeaders
        },
        "Makcorps request failed"
      );
    } catch (error) {
      const canRetryWithRapidApi =
        Boolean(apiKeyAuth) && !shouldUseRapidApiTransport() && shouldRetryWithRapidApi(error);

      if (!canRetryWithRapidApi) {
        throw error;
      }

      const rapidApiAuth = buildApiKeyAuth(true);
      if (!rapidApiAuth) {
        throw error;
      }

      const rapidUrl = buildUrl(rapidApiAuth.baseUrl, path, {
        ...params,
        ...rapidApiAuth.query
      });

      payload = await fetchJson<T>(
        rapidUrl,
        {
          headers: rapidApiAuth.headers
        },
        "Makcorps request failed"
      );
    }

    setProviderCache(cacheKey, payload, 15 * 60 * 1000);
    return payload;
  });
}

export async function diagnoseMakcorpsCompset(params: {
  city: string;
  checkInDate: string;
  checkOutDate: string;
}) {
  const configSnapshot: MakcorpsDiagnosticsReport["configSnapshot"] = {
    hasApiKey: Boolean(config.makcorpsApiKey),
    hasUsernamePassword: Boolean(config.makcorpsUsername && config.makcorpsPassword),
    useRapidApiFlag: Boolean(config.makcorpsUseRapidApi),
    baseUrl: config.makcorpsBaseUrl,
    rapidApiBaseUrl: config.makcorpsRapidApiBaseUrl
  };

  if (!isConfigured()) {
    return {
      configured: false,
      configSnapshot,
      attempts: [],
      recommendedMode: "none",
      recommendation: "Makcorps is not configured. Add MAKCORPS_API_KEY (preferred) or username/password."
    } satisfies MakcorpsDiagnosticsReport;
  }

  const profiles: DiagnosticProfile[] = [];
  if (config.makcorpsApiKey) {
    const direct = buildApiKeyAuth(false);
    const rapid = buildApiKeyAuth(true);
    if (direct) {
      profiles.push({
        mode: "direct_query",
        baseUrl: direct.baseUrl,
        headers: direct.headers,
        query: direct.query
      });
    }
    if (rapid) {
      profiles.push({
        mode: "rapidapi",
        baseUrl: rapid.baseUrl,
        headers: rapid.headers,
        query: rapid.query
      });
    }
  }

  if (config.makcorpsUsername && config.makcorpsPassword) {
    try {
      const token = await getAuthToken();
      profiles.push({
        mode: "oauth",
        baseUrl: config.makcorpsBaseUrl,
        headers: { Authorization: `Bearer ${token}` },
        query: {}
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Makcorps auth failed";
      return {
        configured: true,
        configSnapshot,
        attempts: [
          {
            profile: "oauth",
            step: "auth_token",
            requestUrl: `${config.makcorpsBaseUrl}/auth`,
            ok: false,
            status: error instanceof UpstreamError ? error.status : 500,
            message,
            detailsPreview:
              error instanceof UpstreamError ? previewDetails(error.details) : previewDetails(error)
          }
        ],
        recommendedMode: "none",
        recommendation: "Makcorps OAuth auth failed. Verify username/password credentials."
      } satisfies MakcorpsDiagnosticsReport;
    }
  }

  const attempts: MakcorpsDiagnosticAttempt[] = [];

  for (const profile of profiles) {
    const mapping = await runDiagnosticRequest(profile, "mapping_name", "/mapping", {
      name: params.city
    });
    attempts.push(mapping.attempt);

    const cityId = mapping.attempt.ok ? extractCityIdFromMapping(mapping.payload) : null;
    if (cityId) {
      const cityById = await runDiagnosticRequest(profile, "city_cityid", "/city", {
        cityid: cityId,
        pagination: 0,
        cur: "USD",
        rooms: 1,
        adults: 2,
        checkin: params.checkInDate,
        checkout: params.checkOutDate,
        tax: true
      });
      attempts.push(cityById.attempt);
    } else {
      attempts.push({
        profile: profile.mode,
        step: "mapping_cityid_missing",
        requestUrl: "(derived from /mapping payload)",
        ok: false,
        status: 422,
        message: "No city id was found in mapping response."
      });
    }

    const legacyPath = await runDiagnosticRequest(profile, "legacy_city_path", `/city/${encodeURIComponent(params.city)}`, {
      checkin: params.checkInDate,
      checkout: params.checkOutDate
    });
    attempts.push(legacyPath.attempt);

    const legacyQuery = await runDiagnosticRequest(profile, "legacy_city_query", "/city", {
      city: params.city,
      checkin: params.checkInDate,
      checkout: params.checkOutDate
    });
    attempts.push(legacyQuery.attempt);
  }

  const successfulCompsetAttempts = attempts.filter(
    (attempt) => attempt.ok && (attempt.normalizedHotelCount ?? 0) > 0
  );
  const bestAttempt = successfulCompsetAttempts.sort(
    (a, b) => (b.normalizedHotelCount ?? 0) - (a.normalizedHotelCount ?? 0)
  )[0];

  if (bestAttempt) {
    return {
      configured: true,
      configSnapshot,
      attempts,
      recommendedMode: bestAttempt.profile,
      recommendation: `Makcorps works via ${bestAttempt.profile}. Use this mode for production requests.`
    } satisfies MakcorpsDiagnosticsReport;
  }

  const hadAny2xx = attempts.some((attempt) => attempt.ok);
  return {
    configured: true,
    configSnapshot,
    attempts,
    recommendedMode: "none",
    recommendation: hadAny2xx
      ? "Connectivity exists but no usable hotel payloads were returned. Verify account endpoint access and city/date combinations."
      : "No endpoint/profile combination succeeded. Verify key type, plan permissions, and enabled Makcorps endpoints."
  } satisfies MakcorpsDiagnosticsReport;
}

export async function searchMakcorpsCompset(params: {
  city: string;
  checkInDate: string;
  checkOutDate: string;
  maxResults?: number;
}) {
  if (!isConfigured()) {
    throw new UpstreamError("Makcorps provider not configured", 503, {
      provider: PROVIDER,
      code: "NOT_CONFIGURED"
    });
  }

  // Preferred Makcorps flow (API key docs): mapping(name) -> city(cityid)
  if (config.makcorpsApiKey) {
    try {
      const mappingPayload = await makcorpsGet<unknown>("/mapping", {
        name: params.city
      });
      const cityId = extractCityIdFromMapping(mappingPayload);

      if (cityId) {
        const cityPayload = await makcorpsGet<unknown>("/city", {
          cityid: cityId,
          pagination: 0,
          cur: "USD",
          rooms: 1,
          adults: 2,
          checkin: params.checkInDate,
          checkout: params.checkOutDate,
          tax: true
        });

        const normalized = normalizeCompsetPayload(cityPayload);
        if (normalized.length > 0) {
          return normalized.slice(0, Math.max(1, params.maxResults ?? 10));
        }
      }
    } catch {
      // Fall through to legacy endpoint shapes for compatibility.
    }
  }

  let payload: unknown;

  try {
    payload = await makcorpsGet<unknown>(`/city/${encodeURIComponent(params.city)}`, {
      checkin: params.checkInDate,
      checkout: params.checkOutDate
    });
  } catch (error) {
    if (!isRouteNotFound(error)) {
      throw error;
    }

    try {
      payload = await makcorpsGet<unknown>("/city", {
        city: params.city,
        checkin: params.checkInDate,
        checkout: params.checkOutDate
      });
    } catch (secondError) {
      if (!isRouteNotFound(secondError)) {
        throw secondError;
      }

      payload = await makcorpsGet<unknown>("/mapping", {
        city: params.city,
        checkin: params.checkInDate,
        checkout: params.checkOutDate
      });
    }
  }

  const normalized = normalizeCompsetPayload(payload);
  return normalized.slice(0, Math.max(1, params.maxResults ?? 10));
}

export async function getMakcorpsHotelRates(params: {
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
}) {
  if (!isConfigured()) {
    throw new UpstreamError("Makcorps provider not configured", 503, {
      provider: PROVIDER,
      code: "NOT_CONFIGURED"
    });
  }

  let payload: unknown;

  try {
    payload = await makcorpsGet<unknown>("/hotel", {
      hotelid: params.hotelId,
      checkin: params.checkInDate,
      checkout: params.checkOutDate
    });
  } catch (error) {
    if (!isRouteNotFound(error)) {
      throw error;
    }

    payload = await makcorpsGet<unknown>(`/hotel/${encodeURIComponent(params.hotelId)}`, {
      checkin: params.checkInDate,
      checkout: params.checkOutDate
    });
  }

  const normalized = normalizeCompsetPayload(payload);
  return normalized[0] ?? null;
}
