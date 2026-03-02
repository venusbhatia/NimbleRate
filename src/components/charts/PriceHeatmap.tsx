import type { PricingRecommendation } from "../../types/pricing";
import { PriceCalendar } from "../../features/pricing/PriceCalendar";

interface PriceHeatmapProps {
  pricing: PricingRecommendation[];
  eventDates: Set<string>;
}

export function PriceHeatmap({ pricing, eventDates }: PriceHeatmapProps) {
  return <PriceCalendar pricing={pricing} eventDates={eventDates} />;
}
