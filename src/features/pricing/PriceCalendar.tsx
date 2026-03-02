import { format, parseISO } from "date-fns";
import { Card } from "../../components/ui/Card";
import type { PricingRecommendation } from "../../types/pricing";
import { getPriceColorClass } from "../../utils/colorScale";

interface PriceCalendarProps {
  pricing: PricingRecommendation[];
  eventDates: Set<string>;
  holidayDates: Set<string>;
  longWeekendDates: Set<string>;
  highDemandDates: Set<string>;
  pricingReasonsByDate: Map<string, string[]>;
}

export function PriceCalendar({
  pricing,
  eventDates,
  holidayDates,
  longWeekendDates,
  highDemandDates,
  pricingReasonsByDate
}: PriceCalendarProps) {
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
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" /> Holiday
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" /> Long weekend
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> High demand
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {pricing.map((day) => {
          const hasEvent = eventDates.has(day.date);
          const isHoliday = holidayDates.has(day.date);
          const isLongWeekend = longWeekendDates.has(day.date);
          const isHighDemand = highDemandDates.has(day.date);
          const reasons = pricingReasonsByDate.get(day.date) ?? ["Baseline market conditions"];

          return (
            <div
              key={day.date}
              title={`Why this day moved: ${reasons.join(", ")}`}
              className={`relative rounded-xl border p-2 text-xs ${getPriceColorClass(day.finalRate, minRate, maxRate)} ${
                isLongWeekend ? "border-amber-300 dark:border-amber-600/40" : "border-white/60 dark:border-white/10"
              }`}
            >
              <p className="font-semibold">{format(parseISO(day.date), "d")}</p>
              <p className="mt-1 font-bold tabular-nums">${day.finalRate.toFixed(0)}</p>
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                {hasEvent ? <span className="h-2 w-2 rounded-full bg-violet-500" /> : null}
                {isHoliday ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                {isLongWeekend ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                {isHighDemand ? <span className="h-2 w-2 rounded-full bg-red-500" /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
