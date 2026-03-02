import { config } from "../../config.js";
import { type ExternalProvider } from "../../types.js";
import { buildUrl, fetchJson, UpstreamError } from "../http.js";
import { getProviderCache, runProviderSerialized, setProviderCache } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";
import type { PmsAdapter } from "./types.js";

const PROVIDER: ExternalProvider = "cloudbeds";
const CACHE_TTL_MS = 5 * 60 * 1000;

type CloudbedsReservation = {
  checkIn: string;
  checkOut: string;
  roomCount: number;
  status: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.includes("T") ? value.slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function extractArrayPayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const objectPayload = payload as Record<string, unknown>;
  const candidates = [objectPayload.data, objectPayload.reservations, objectPayload.result, objectPayload.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
    }
  }

  return [];
}

function normalizeReservations(payload: unknown): CloudbedsReservation[] {
  const rows = extractArrayPayload(payload);

  return rows
    .map((entry) => {
      const checkIn =
        parseIsoDate(entry.checkin) ??
        parseIsoDate(entry.check_in) ??
        parseIsoDate(entry.arrivalDate) ??
        parseIsoDate(entry.arrival_date) ??
        parseIsoDate(entry.startDate) ??
        parseIsoDate(entry.start_date);
      const checkOut =
        parseIsoDate(entry.checkout) ??
        parseIsoDate(entry.check_out) ??
        parseIsoDate(entry.departureDate) ??
        parseIsoDate(entry.departure_date) ??
        parseIsoDate(entry.endDate) ??
        parseIsoDate(entry.end_date);

      if (!checkIn || !checkOut) {
        return null;
      }

      const roomCountRaw =
        Number(entry.rooms) ||
        Number(entry.roomCount) ||
        Number(entry.room_count) ||
        Number(entry.numberOfRooms) ||
        1;
      const roomCount = Math.max(1, Math.round(roomCountRaw));
      const statusRaw = String(entry.status ?? entry.reservation_status ?? "confirmed").toLowerCase();

      return {
        checkIn,
        checkOut,
        roomCount,
        status: statusRaw
      };
    })
    .filter((entry): entry is CloudbedsReservation => Boolean(entry))
    .filter((entry) => !entry.status.includes("cancel") && !entry.status.includes("void") && !entry.status.includes("no_show"));
}

function fetchReservationsCacheKey(request: {
  propertyId: string;
  checkInDate: string;
  daysForward: number;
}) {
  return `cloudbeds:${request.propertyId}:${request.checkInDate}:${request.daysForward}`;
}

async function fetchCloudbedsReservations(
  propertyId: string,
  checkInDate: string,
  daysForward: number
): Promise<CloudbedsReservation[]> {
  const cacheKey = fetchReservationsCacheKey({ propertyId, checkInDate, daysForward });
  const cached = getProviderCache<CloudbedsReservation[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const dateStart = new Date(`${checkInDate}T00:00:00Z`);
  const dateEnd = new Date(dateStart.getTime() + daysForward * 24 * 60 * 60 * 1000);
  const endDate = dateEnd.toISOString().slice(0, 10);

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${config.cloudbedsApiKey ?? ""}`,
    "x-api-key": config.cloudbedsApiKey ?? ""
  };

  const endpointCandidates = ["/getReservations", "/reservations", "/reservation"];
  let lastError: unknown = null;

  for (const path of endpointCandidates) {
    const url = buildUrl(config.cloudbedsBaseUrl, path, {
      propertyID: propertyId,
      propertyId,
      startDate: checkInDate,
      endDate,
      checkInDate,
      checkOutDate: endDate,
      page: 1,
      perPage: 500
    });

    try {
      assertProviderBudget(PROVIDER);
      incrementProviderUsage(PROVIDER);
      const payload = await fetchJson<unknown>(
        url,
        {
          method: "GET",
          headers
        },
        "Cloudbeds reservation request failed"
      );

      const normalized = normalizeReservations(payload);
      setProviderCache(cacheKey, normalized, CACHE_TTL_MS);
      return normalized;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof UpstreamError) {
    throw lastError;
  }

  throw new UpstreamError("Cloudbeds reservation request failed", 502, {
    provider: "cloudbeds",
    code: "UPSTREAM_FAILED"
  });
}

function toPaceRows(
  reservations: CloudbedsReservation[],
  checkInDate: string,
  daysForward: number,
  totalRooms: number
) {
  const occupancyByDate = new Map<string, number>();
  const dateKeys = Array.from({ length: daysForward }).map((_, idx) => {
    const date = new Date(`${checkInDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + idx);
    return date.toISOString().slice(0, 10);
  });

  const validDateSet = new Set(dateKeys);

  reservations.forEach((reservation) => {
    const start = new Date(`${reservation.checkIn}T00:00:00Z`);
    const end = new Date(`${reservation.checkOut}T00:00:00Z`);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      return;
    }

    const cursor = new Date(start);
    while (cursor < end) {
      const key = cursor.toISOString().slice(0, 10);
      if (validDateSet.has(key)) {
        occupancyByDate.set(key, (occupancyByDate.get(key) ?? 0) + reservation.roomCount);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  });

  return dateKeys.map((dateKey, idx) => {
    const roomsBooked = clamp(Math.round(occupancyByDate.get(dateKey) ?? 0), 0, totalRooms);
    const occupancyRate = totalRooms > 0 ? Math.round((roomsBooked / totalRooms) * 100) : 0;
    const priorWeekKey = idx >= 7 ? dateKeys[idx - 7] : null;
    const priorWeekBooked = priorWeekKey ? occupancyByDate.get(priorWeekKey) ?? 0 : 0;
    const pickupLast7Days = Math.max(0, roomsBooked - priorWeekBooked);
    const occupancyLastYear = clamp(occupancyRate - 5, 5, 99);

    return {
      date: dateKey,
      roomsBooked,
      roomsAvailable: Math.max(0, totalRooms - roomsBooked),
      occupancyRate,
      pickupLast7Days,
      occupancyLastYear
    };
  });
}

export function createCloudbedsAdapter(): PmsAdapter {
  return {
    provider: "cloudbeds",
    async getPace(request) {
      if (!config.cloudbedsApiKey || !config.cloudbedsPropertyId) {
        throw new UpstreamError("Cloudbeds credentials missing", 503, {
          provider: "cloudbeds",
          code: "NOT_CONFIGURED"
        });
      }

      return runProviderSerialized(PROVIDER, async () => {
        const reservations = await fetchCloudbedsReservations(
          config.cloudbedsPropertyId as string,
          request.checkInDate,
          request.daysForward
        );
        return toPaceRows(reservations, request.checkInDate, request.daysForward, request.totalRooms);
      });
    },
    async health() {
      const configured = Boolean(config.cloudbedsApiKey && config.cloudbedsPropertyId);
      return {
        provider: "cloudbeds",
        configured,
        message: configured
          ? "Cloudbeds credentials detected; live reservation ingestion enabled."
          : "Cloudbeds credentials missing; using simulated PMS fallback."
      };
    }
  };
}
