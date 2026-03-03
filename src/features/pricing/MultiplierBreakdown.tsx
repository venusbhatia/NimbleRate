import { Card } from "../../components/ui/Card";
import type { PricingRecommendation } from "../../types/pricing";

interface MultiplierBreakdownProps {
  recommendation: PricingRecommendation;
}

function factorLabel(value: number): { text: string; color: string } {
  if (value > 1.15) return { text: "Strong boost", color: "bg-emerald-500" };
  if (value > 1.02) return { text: "Slight boost", color: "bg-emerald-400" };
  if (value >= 0.98) return { text: "Neutral", color: "bg-gray-400 dark:bg-gray-500" };
  if (value >= 0.85) return { text: "Slight dip", color: "bg-amber-400" };
  return { text: "Lowering", color: "bg-red-400" };
}

export function MultiplierBreakdown({ recommendation }: MultiplierBreakdownProps) {
  const rows = [
    { label: "Occupancy", hint: "How full your property is", value: recommendation.factors.occupancyRate },
    { label: "Day of Week", hint: "Weekend vs weekday demand", value: recommendation.factors.dayOfWeek },
    { label: "Seasonality", hint: "Time of year trends", value: recommendation.factors.seasonality },
    { label: "Events", hint: "Nearby events driving demand", value: recommendation.factors.events },
    { label: "Weather", hint: "Weather conditions impact", value: recommendation.factors.weather },
    { label: "Holiday", hint: "Public holiday premium", value: recommendation.factors.holiday },
    { label: "Lead Time", hint: "How far out the date is", value: recommendation.factors.leadTime }
  ];

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <h3 className="mb-4 text-lg font-semibold tracking-tight">What's Affecting Your Price</h3>
      <div className="space-y-2">
        {rows.map((row) => {
          const { text, color } = factorLabel(row.value);
          const barWidth = Math.min(100, Math.max(10, ((row.value - 0.5) / 1.5) * 100));
          return (
            <div key={row.label} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-neutral-800">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-dune-800 dark:text-gray-200">{row.label}</span>
                  <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{row.hint}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{text}</span>
                  <span className="font-semibold tabular-nums">{row.value.toFixed(2)}×</span>
                </div>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-neutral-700">
                <div
                  className={`h-full rounded-full transition-all ${color}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-xl border border-gold-200 bg-gold-50 p-3 text-sm text-gold-900 dark:border-gold-700/40 dark:bg-gold-900/20 dark:text-gold-300">
        <p>
          Combined factors suggest <strong>{recommendation.rawMultiplier.toFixed(2)}×</strong>, capped
          to <strong>{recommendation.finalMultiplier.toFixed(2)}×</strong> for stability.
        </p>
        <p className="mt-1 text-xs opacity-80">
          If your normal rate is $100, tonight's recommendation is ${(100 * recommendation.finalMultiplier).toFixed(0)}.
        </p>
      </div>
    </Card>
  );
}
