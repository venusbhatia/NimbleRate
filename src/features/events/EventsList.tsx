import { Calendar, MapPin, Music, Ticket, CalendarOff } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { TicketmasterEvent } from "../../types/events";

interface EventsListProps {
  events: TicketmasterEvent[];
}

export function EventsList({ events }: EventsListProps) {
  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Upcoming Events Near You</h3>
        <Badge tone="gold">{events.length} events</Badge>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <CalendarOff className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No upcoming events found</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Try expanding your date range or location</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.slice(0, 6).map((event) => (
            <div key={event.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-semibold">{event.name}</p>
                <Badge tone="neutral">{event.segment ?? "Event"}</Badge>
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
