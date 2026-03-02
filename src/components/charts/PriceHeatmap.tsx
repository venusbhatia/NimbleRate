import type { PricingRecommendation } from "../../types/pricing";
import { PriceCalendar } from "../../features/pricing/PriceCalendar";

interface PriceHeatmapProps {
  pricing: PricingRecommendation[];
  eventDates: Set<string>;
  holidayDates: Set<string>;
  longWeekendDates: Set<string>;
  highDemandDates: Set<string>;
  pricingReasonsByDate: Map<string, string[]>;
}

export function PriceHeatmap({
  pricing,
  eventDates,
  holidayDates,
  longWeekendDates,
  highDemandDates,
  pricingReasonsByDate
}: PriceHeatmapProps) {
  return (
    <PriceCalendar
      pricing={pricing}
      eventDates={eventDates}
      holidayDates={holidayDates}
      longWeekendDates={longWeekendDates}
      highDemandDates={highDemandDates}
      pricingReasonsByDate={pricingReasonsByDate}
    />
  );
}
