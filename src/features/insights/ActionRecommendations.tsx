import { ArrowDownRight, ArrowRight, ArrowUpRight, Target } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { ActionRecommendation, DataQualityInsight, DemandInsight, MarketSignalsSummary } from "../../types/dashboard";

interface ActionRecommendationsProps {
  demand: DemandInsight;
  dataQuality: DataQualityInsight;
  actions: ActionRecommendation[];
  signals: MarketSignalsSummary;
}

function formatCurrencyDelta(value: number) {
  const prefix = value >= 0 ? "+" : "-";
  return `${prefix}$${Math.abs(value).toFixed(0)}`;
}

function toneForAction(action: ActionRecommendation["action"]) {
  if (action === "raise") return "positive";
  if (action === "lower") return "negative";
  return "neutral";
}

function iconForAction(action: ActionRecommendation["action"]) {
  if (action === "raise") return ArrowUpRight;
  if (action === "lower") return ArrowDownRight;
  return ArrowRight;
}

export function ActionRecommendations({ demand, dataQuality, actions, signals }: ActionRecommendationsProps) {
  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Action Recommendations</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Demand level: <span className="font-semibold capitalize">{demand.level}</span> ({demand.index}/100)
          </p>
        </div>
        <Badge tone={dataQuality.hasApiErrors ? "negative" : "positive"}>
          Confidence {dataQuality.confidenceScore}/100
        </Badge>
      </div>

      <div className="mb-4 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 dark:text-gray-300">
        <p>Event days: <span className="font-semibold tabular-nums">{signals.eventDays}</span></p>
        <p>Holiday days: <span className="font-semibold tabular-nums">{signals.holidayDays}</span></p>
        <p>Long-weekend days: <span className="font-semibold tabular-nums">{signals.longWeekendDays}</span></p>
        <p>Weather-risk days: <span className="font-semibold tabular-nums">{signals.weatherRiskDays}</span></p>
      </div>

      <div className="space-y-3">
        {actions.slice(0, 3).map((action) => {
          const Icon = iconForAction(action.action);
          return (
            <div key={action.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-neutral-800">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-gray-500 dark:text-gray-300" />
                  <p className="text-sm font-semibold">{action.title}</p>
                </div>
                <Badge tone={toneForAction(action.action)} className="capitalize">
                  {action.action}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{action.rationale}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-white px-2 py-1 font-semibold tabular-nums text-dune-800 dark:bg-neutral-900 dark:text-gray-100">
                  ADR {formatCurrencyDelta(action.expectedAdrImpact)}
                </span>
                <span className="rounded-md bg-white px-2 py-1 font-semibold tabular-nums text-dune-800 dark:bg-neutral-900 dark:text-gray-100">
                  RevPAR {formatCurrencyDelta(action.expectedRevparImpact)}
                </span>
                <span className="rounded-md bg-white px-2 py-1 font-semibold tabular-nums text-dune-800 dark:bg-neutral-900 dark:text-gray-100">
                  Confidence {action.confidence}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {dataQuality.missingSources.length ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <p className="font-semibold">Signal gaps</p>
          <p className="mt-1">{dataQuality.missingSources.join(", ")} unavailable. Recommendations are adjusted with lower certainty.</p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          <Target className="h-3.5 w-3.5" />
          All core data signals are available.
        </div>
      )}
    </Card>
  );
}
