import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  format,
  isWithinInterval,
  parseISO,
  startOfDay
} from "date-fns";

export function getNextThirtyDays(startDate: string) {
  const start = parseISO(startDate);
  const end = addDays(start, 29);
  return eachDayOfInterval({ start, end }).map((date) => format(date, "yyyy-MM-dd"));
}

export function toUtcIsoStart(date: string) {
  return `${date}T00:00:00Z`;
}

export function toUtcIsoEnd(date: string) {
  return `${date}T23:59:59Z`;
}

export function isDateWithinRange(targetDate: string, startDate: string, endDate: string) {
  const target = parseISO(targetDate);
  return isWithinInterval(target, {
    start: startOfDay(parseISO(startDate)),
    end: endOfDay(parseISO(endDate))
  });
}

export function dayLabel(date: string) {
  return format(parseISO(date), "EEE d");
}

export function fullDateLabel(date: string) {
  return format(parseISO(date), "EEE, MMM d");
}
