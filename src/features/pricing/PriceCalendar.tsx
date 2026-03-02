import { format, parseISO } from "date-fns";
import { Card } from "../../components/ui/Card";
import type { PricingRecommendation } from "../../types/pricing";
import { getPriceColorClass } from "../../utils/colorScale";

interface PriceCalendarProps {
  pricing: PricingRecommendation[];
  eventDates: Set<string>;
}

export function PriceCalendar({ pricing, eventDates }: PriceCalendarProps) {
  const rates = pricing.map((item) => item.finalRate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Your 30-Day Rate Calendar</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200" /> Low
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-200" /> Mid
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-200" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500" /> Event
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {pricing.map((day) => (
          <div
            key={day.date}
            className={`relative rounded-xl p-2 text-xs ${getPriceColorClass(day.finalRate, minRate, maxRate)} border border-white/60 dark:border-white/10`}
          >
            <p className="font-semibold">{format(parseISO(day.date), "d")}</p>
            <p className="mt-1 font-bold tabular-nums">${day.finalRate.toFixed(0)}</p>
            {eventDates.has(day.date) ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-violet-500" />
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
