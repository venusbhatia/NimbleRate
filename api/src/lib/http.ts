import type { ApiErrorShape } from "../types.js";

export class UpstreamError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.details = details;
  }
}

export class RequestValidationError extends Error {
  status: number;

  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
    this.status = 400;
  }
}

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const responseCache = new Map<string, CacheEntry>();

function serializeParams(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export function buildUrl(baseUrl: string, path: string, params: Record<string, string | number | boolean | undefined> = {}) {
  return `${baseUrl}${path}${serializeParams(params)}`;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  errorMessage = "Upstream request failed"
): Promise<T> {
  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw new UpstreamError(errorMessage, response.status, payload);
  }

  return payload as T;
}

export async function fetchJsonCached<T>(
  url: string,
  init: RequestInit = {},
  errorMessage = "Upstream request failed",
  ttlMs = 60_000
): Promise<T> {
  const method = init.method ?? "GET";
  if (method !== "GET" || ttlMs <= 0) {
    return fetchJson<T>(url, init, errorMessage);
  }

  const now = Date.now();
  const cached = responseCache.get(url);

  if (cached && now < cached.expiresAt) {
    return cached.payload as T;
  }

  const payload = await fetchJson<T>(url, init, errorMessage);

  responseCache.set(url, {
    payload,
    expiresAt: now + ttlMs
  });

  return payload;
}

export function clearResponseCache() {
  responseCache.clear();
}

export function toApiError(error: unknown, fallbackMessage = "Server error", fallbackStatus = 500): ApiErrorShape {
  if (error instanceof RequestValidationError) {
    return {
      message: error.message,
      status: error.status
    };
  }

  if (error instanceof UpstreamError) {
    return {
      message: error.message,
      status: error.status,
      details: error.details
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      status: fallbackStatus
    };
  }

  return {
    message: fallbackMessage,
    status: fallbackStatus
  };
}
