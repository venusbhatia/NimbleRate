import { Calendar, MapPin, Music, Ticket, CalendarOff } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { TicketmasterEvent } from "../../types/events";

interface EventsListProps {
  events: TicketmasterEvent[];
  limit?: number;
}

type EventsSort = "date-asc" | "impact-desc";

function eventTimestamp(event: TicketmasterEvent) {
  const raw = event.date.includes("T") ? event.date : `${event.date}T00:00:00`;
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function eventImpactScore(event: TicketmasterEvent) {
  const popularityScore = Math.min(60, Math.max(0, event.popularityScore));
  const priceScore = Math.min(25, ((event.maxPrice ?? event.minPrice ?? 0) / 500) * 25);
  const statusScore = event.status === "onsale" ? 15 : event.status === "offsale" ? 5 : 0;
  return Math.round(popularityScore + priceScore + statusScore);
}

export function EventsList({ events, limit = 6 }: EventsListProps) {
  const [sortBy, setSortBy] = useState<EventsSort>("impact-desc");

  const visibleEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      if (sortBy === "date-asc") {
        return eventTimestamp(a) - eventTimestamp(b);
      }
      return eventImpactScore(b) - eventImpactScore(a);
    });
    return sorted.slice(0, limit);
  }, [events, limit, sortBy]);

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Upcoming Events Near You</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Includes impact scoring from popularity, pricing, and status.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="gold">{events.length} events</Badge>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as EventsSort)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-neutral-900"
          >
            <option value="impact-desc">Impact desc</option>
            <option value="date-asc">Date asc</option>
          </select>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarOff className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No upcoming events found</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Try expanding your date range or location</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleEvents.map((event) => (
            <div key={event.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-semibold">{event.name}</p>
                <div className="flex items-center gap-1.5">
                  <Badge tone="gold">Impact {eventImpactScore(event)}</Badge>
                  <Badge tone="neutral">{event.segment ?? "Event"}</Badge>
                </div>
              </div>
              <div className="grid gap-1 text-xs text-gray-600 dark:text-gray-300">
                <p className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {event.date}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  {event.venueName ?? "Venue TBA"}
                </p>
                <p className="flex items-center gap-2">
                  <Music className="h-3.5 w-3.5" />
                  {event.genre ?? "General"}
                </p>
                <p className="flex items-center gap-2 font-semibold text-dune-900 dark:text-white">
                  <Ticket className="h-3.5 w-3.5" />
                  {event.maxPrice
                    ? `${event.currency ?? "USD"} ${event.minPrice ?? "-"} - ${event.maxPrice}`
                    : "Price unavailable"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
