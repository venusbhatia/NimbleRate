import { Calendar, MapPin, Music, Ticket } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { TicketmasterEvent } from "../../types/events";

interface EventsListProps {
  events: TicketmasterEvent[];
  limit?: number;
}

export function EventsList({ events, limit = 6 }: EventsListProps) {
  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Nearby Demand Drivers</h3>
        <Badge tone="gold">{events.length} events</Badge>
      </div>
      <div className="space-y-3">
        {events.slice(0, limit).map((event) => (
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
                {event.maxPrice ? `${event.currency ?? "USD"} ${event.minPrice ?? "-"} - ${event.maxPrice}` : "Price unavailable"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
