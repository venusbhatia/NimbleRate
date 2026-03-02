import { Card } from "../../components/ui/Card";
import type { PricingRecommendation } from "../../types/pricing";

interface MultiplierBreakdownProps {
  recommendation: PricingRecommendation;
}

export function MultiplierBreakdown({ recommendation }: MultiplierBreakdownProps) {
  const rows = [
    { label: "Occupancy", value: recommendation.factors.occupancyRate },
    { label: "Day of Week", value: recommendation.factors.dayOfWeek },
    { label: "Seasonality", value: recommendation.factors.seasonality },
    { label: "Events", value: recommendation.factors.events },
    { label: "Weather", value: recommendation.factors.weather },
    { label: "Holiday", value: recommendation.factors.holiday },
    { label: "Lead Time", value: recommendation.factors.leadTime }
  ];

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <h3 className="mb-4 text-lg font-semibold tracking-tight">Multiplier Breakdown</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-neutral-800">
            <span className="text-gray-600 dark:text-gray-300">{row.label}</span>
            <span className="font-semibold tabular-nums">{row.value.toFixed(2)}x</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-gold-200 bg-gold-50 p-3 text-sm text-gold-900">
        Raw: <strong>{recommendation.rawMultiplier.toFixed(2)}x</strong> | Final: <strong>{recommendation.finalMultiplier.toFixed(2)}x</strong>
      </div>
    </Card>
  );
}
