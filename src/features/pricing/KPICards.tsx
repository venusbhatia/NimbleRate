import { ArrowDownRight, ArrowUpRight, Building, ChartLine, Gauge } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Tooltip } from "../../components/ui/Tooltip";
import type { DashboardKpis } from "../../types/dashboard";

interface KPICardsProps {
  kpis: DashboardKpis;
}

const cards = [
  {
    key: "adr",
    label: "Avg. Nightly Rate",
    tooltip: "Average Daily Rate across your 30-day forecast",
    icon: Building,
    value: (kpis: DashboardKpis) => `$${kpis.adr.toFixed(0)}`,
    delta: (kpis: DashboardKpis) => `${kpis.adrDeltaPct >= 0 ? "+" : ""}${kpis.adrDeltaPct.toFixed(1)}%`,
    positive: (kpis: DashboardKpis) => kpis.adrDeltaPct >= 0
  },
  {
    key: "revpar",
    label: "Revenue per Room",
    tooltip: "Revenue Per Available Room — your rate × occupancy",
    icon: ChartLine,
    value: (kpis: DashboardKpis) => `$${kpis.revpar.toFixed(0)}`,
    delta: (kpis: DashboardKpis) => `${kpis.revparDeltaPct >= 0 ? "+" : ""}${kpis.revparDeltaPct.toFixed(1)}%`,
    positive: (kpis: DashboardKpis) => kpis.revparDeltaPct >= 0
  },
  {
    key: "occupancy",
    label: "Occupancy",
    tooltip: "Projected occupancy trend from demand-adjusted pricing pressure",
    icon: Gauge,
    value: (kpis: DashboardKpis) => `${kpis.occupancy.toFixed(0)}%`,
    delta: (kpis: DashboardKpis) => `${kpis.occupancyDeltaPct >= 0 ? "+" : ""}${kpis.occupancyDeltaPct.toFixed(1)}%`,
    positive: (kpis: DashboardKpis) => kpis.occupancyDeltaPct >= 0
  },
  {
    key: "multiplier",
    label: "Price Adjustment",
    tooltip: "How much to adjust your base rate. For example, 1.20× means charge 20% above your normal price. If your rate is $100, tonight's recommendation is $120.",
    icon: ChartLine,
    value: (kpis: DashboardKpis) => `${kpis.activeMultiplier.toFixed(2)}×`,
    delta: (kpis: DashboardKpis) =>
      `${kpis.activeMultiplierDelta >= 0 ? "+" : ""}${kpis.activeMultiplierDelta.toFixed(2)}`,
    positive: (kpis: DashboardKpis) => kpis.activeMultiplierDelta >= 0
  }
] as const;

export function KPICards({ kpis }: KPICardsProps) {
  const demandTone =
    kpis.demandPressureIndex >= 80
      ? "text-red-700 dark:text-red-300"
      : kpis.demandPressureIndex >= 60
        ? "text-amber-700 dark:text-amber-300"
        : "text-emerald-700 dark:text-emerald-300";

  const confidenceTone =
    kpis.dataConfidence >= 75
      ? "text-emerald-700 dark:text-emerald-300"
      : kpis.dataConfidence >= 50
        ? "text-amber-700 dark:text-amber-300"
        : "text-red-700 dark:text-red-300";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const isPositive = card.positive(kpis);
          return (
            <Card key={card.key} className="animate-fadeIn bg-white/95 dark:bg-neutral-900/95">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {card.label}
                  </p>
                  <Tooltip content={card.tooltip} />
                </div>
                <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-3xl font-bold tabular-nums tracking-tight">{card.value(kpis)}</p>
              <div
                className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                  isPositive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                {card.delta(kpis)}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="bg-white/95 py-4 dark:bg-neutral-900/95">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Data Confidence</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${confidenceTone}`}>{kpis.dataConfidence}/100</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Based on source availability and live API health.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Demand Pressure</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${demandTone}`}>{kpis.demandPressureIndex}/100</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Weighted blend of occupancy, events, holidays, and lead time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
