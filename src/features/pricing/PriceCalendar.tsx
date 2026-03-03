import { useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Copy, Check } from "lucide-react";
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rates = pricing.map((item) => item.finalRate);
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);

  const copyRates = useCallback(() => {
    const text = pricing
      .map((day) => `${format(parseISO(day.date), "EEE, MMM d")}\t$${day.finalRate.toFixed(0)}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [pricing]);

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-tight">Your 30-Day Rate Calendar</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyRates}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-gold-300 hover:text-dune-900 dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-300 dark:hover:border-gold-600"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy rates"}
          </button>
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
      </div>
      <div className="grid grid-cols-7 gap-2" role="grid" aria-label="30-day rate calendar">
        {pricing.map((day) => {
          const hasEvent = eventDates.has(day.date);
          const isHoliday = holidayDates.has(day.date);
          const isLongWeekend = longWeekendDates.has(day.date);
          const isHighDemand = highDemandDates.has(day.date);
          const reasons = pricingReasonsByDate.get(day.date) ?? ["Baseline market conditions"];
          const isExpanded = expandedDate === day.date;

          return (
            <div
              key={day.date}
              role="button"
              tabIndex={0}
              onClick={() => setExpandedDate(isExpanded ? null : day.date)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedDate(isExpanded ? null : day.date);
                }
              }}
              aria-label={`${format(parseISO(day.date), "EEEE, MMMM d")} — $${day.finalRate.toFixed(0)}`}
              title={`Why this day moved: ${reasons.join(", ")}`}
              className={`relative cursor-pointer rounded-xl border p-2 text-xs transition-all ${getPriceColorClass(day.finalRate, minRate, maxRate)} ${
                isLongWeekend ? "border-amber-300 dark:border-amber-600/40" : "border-white/60 dark:border-white/10"
              } ${isExpanded ? "col-span-2 row-span-2 z-10 ring-2 ring-gold-400" : ""}`}
            >
              <p className="font-semibold">{format(parseISO(day.date), "EEE d")}</p>
              <p className="mt-1 font-bold tabular-nums">${day.finalRate.toFixed(0)}</p>
              <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                {hasEvent ? <span className="h-2 w-2 rounded-full bg-violet-500" /> : null}
                {isHoliday ? <span className="h-2 w-2 rounded-full bg-blue-500" /> : null}
                {isLongWeekend ? <span className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                {isHighDemand ? <span className="h-2 w-2 rounded-full bg-red-500" /> : null}
              </div>
              {isExpanded && (
                <div className="mt-2 space-y-1 border-t border-white/30 pt-2 dark:border-white/10">
                  <p className="text-[10px] font-medium text-gray-600 dark:text-gray-300">
                    Multiplier: {day.finalMultiplier.toFixed(2)}×
                  </p>
                  {reasons.map((reason) => (
                    <p key={reason} className="text-[10px] text-gray-500 dark:text-gray-400">
                      • {reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
