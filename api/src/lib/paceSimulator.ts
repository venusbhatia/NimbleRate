import { addDays, format, getDay, parseISO } from "date-fns";

type PaceHotelType = "city" | "business" | "leisure" | "beach" | "ski";

export interface PacePoint {
  date: string;
  roomsBooked: number;
  roomsAvailable: number;
  occupancyRate: number;
  pickupLast7Days: number;
  occupancyLastYear: number;
}

export interface PaceSimulationInput {
  totalRooms: number;
  daysForward: number;
  hotelType: PaceHotelType;
  seed: string;
  startDate?: string;
}

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hotelTypeBias(hotelType: PaceHotelType, dayOfWeek: number) {
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

  if (hotelType === "business" || hotelType === "city") {
    return isWeekend ? -0.08 : 0.05;
  }

  if (hotelType === "leisure" || hotelType === "beach") {
    return isWeekend ? 0.12 : -0.04;
  }

  if (hotelType === "ski") {
    return isWeekend ? 0.08 : 0;
  }

  return 0;
}

export function generatePaceSimulation(input: PaceSimulationInput): PacePoint[] {
  const totalRooms = Math.max(1, Math.round(input.totalRooms));
  const daysForward = clamp(Math.round(input.daysForward), 7, 180);
  const baseDate = input.startDate ? parseISO(input.startDate) : new Date();
  const rand = mulberry32(hashSeed(`${input.seed}:${input.hotelType}:${totalRooms}:${daysForward}`));

  const rows: PacePoint[] = [];

  for (let offset = 0; offset < daysForward; offset += 1) {
    const date = addDays(baseDate, offset);
    const dateKey = format(date, "yyyy-MM-dd");
    const dayOfWeek = getDay(date);

    const leadTimeFactor = clamp(1 - offset / daysForward, 0.2, 1);
    const paceTrend = 0.25 + leadTimeFactor * 0.55;
    const bias = hotelTypeBias(input.hotelType, dayOfWeek);
    const noise = (rand() - 0.5) * 0.12;

    const occupancyRateRaw = clamp(paceTrend + bias + noise, 0.05, 0.98);
    const roomsBooked = Math.round(totalRooms * occupancyRateRaw);
    const occupancyRate = Math.round((roomsBooked / totalRooms) * 100);
    const pickupLast7Days = Math.max(0, Math.round(roomsBooked * (0.1 + rand() * 0.2)));
    const occupancyLastYear = clamp(
      Math.round(occupancyRate + (rand() - 0.5) * 18),
      5,
      99
    );

    rows.push({
      date: dateKey,
      roomsBooked,
      roomsAvailable: totalRooms - roomsBooked,
      occupancyRate,
      pickupLast7Days,
      occupancyLastYear
    });
  }

  return rows;
}
