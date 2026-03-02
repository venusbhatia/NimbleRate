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
    delta: "+8.4%",
    positive: true
  },
  {
    key: "revpar",
    label: "Revenue per Room",
    tooltip: "Revenue Per Available Room — your rate × occupancy",
    icon: ChartLine,
    value: (kpis: DashboardKpis) => `$${kpis.revpar.toFixed(0)}`,
    delta: "+5.1%",
    positive: true
  },
  {
    key: "occupancy",
    label: "Occupancy",
    tooltip: "The estimated occupancy percentage you set",
    icon: Gauge,
    value: (kpis: DashboardKpis) => `${kpis.occupancy.toFixed(0)}%`,
    delta: "-1.2%",
    positive: false
  },
  {
    key: "multiplier",
    label: "Price Adjustment",
    tooltip: "How much your base rate is being adjusted today based on all factors",
    icon: ChartLine,
    value: (kpis: DashboardKpis) => `${kpis.activeMultiplier.toFixed(2)}×`,
    delta: "+0.12",
    positive: true
  }
] as const;

export function KPICards({ kpis }: KPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
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
                card.positive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {card.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {card.delta}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
