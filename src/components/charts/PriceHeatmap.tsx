import type { PricingRecommendation } from "../../types/pricing";
import { PriceCalendar } from "../../features/pricing/PriceCalendar";

interface PriceHeatmapProps {
  pricing: PricingRecommendation[];
  eventDates: Set<string>;
  holidayDates: Set<string>;
  longWeekendDates: Set<string>;
  highDemandDates: Set<string>;
  pricingReasonsByDate: Map<string, string[]>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export function PriceHeatmap({
  pricing,
  eventDates,
  holidayDates,
  longWeekendDates,
  highDemandDates,
  pricingReasonsByDate,
  selectedDate,
  onSelectDate
}: PriceHeatmapProps) {
  return (
    <PriceCalendar
      pricing={pricing}
      eventDates={eventDates}
      holidayDates={holidayDates}
      longWeekendDates={longWeekendDates}
      highDemandDates={highDemandDates}
      pricingReasonsByDate={pricingReasonsByDate}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
    />
  );
}
