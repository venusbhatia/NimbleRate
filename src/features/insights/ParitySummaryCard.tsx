import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import type { ParitySummaryResponse } from "../../types/parity";

interface ParitySummaryCardProps {
  parity: ParitySummaryResponse | null;
  directRate: number;
}

function riskTone(level: "low" | "medium" | "high") {
  if (level === "high") return "negative";
  if (level === "medium") return "gold";
  return "positive";
}

function riskIcon(level: "low" | "medium" | "high") {
  if (level === "high") return ShieldAlert;
  if (level === "medium") return AlertTriangle;
  return ShieldCheck;
}

export function ParitySummaryCard({ parity, directRate }: ParitySummaryCardProps) {
  if (!parity) {
    return (
      <Card className="bg-white/95 dark:bg-neutral-900/95">
        <h3 className="text-lg font-semibold tracking-tight">Rate Parity Monitor</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Run analysis for this date range to generate a compset snapshot and parity signal.
        </p>
      </Card>
    );
  }

  const Icon = riskIcon(parity.summary.riskLevel);

  return (
    <Card className="bg-white/95 dark:bg-neutral-900/95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Rate Parity Monitor</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Direct rate ${directRate.toFixed(0)} with ±{parity.tolerancePct.toFixed(1)}% tolerance
          </p>
        </div>
        <Badge tone={riskTone(parity.summary.riskLevel)} className="capitalize">
          {parity.summary.riskLevel} risk
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2 dark:text-gray-300">
        <p>Undercut: <span className="font-semibold tabular-nums">{parity.summary.undercutCount}</span></p>
        <p>Parity: <span className="font-semibold tabular-nums">{parity.summary.parityCount}</span></p>
        <p>Overcut: <span className="font-semibold tabular-nums">{parity.summary.overcutCount}</span></p>
        <p>Undercut share: <span className="font-semibold tabular-nums">{parity.summary.undercutPct.toFixed(1)}%</span></p>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200/70 bg-gray-50/80 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-neutral-800 dark:text-gray-200">
        <Icon className="h-3.5 w-3.5" />
        Snapshot at {new Date(parity.snapshotAt).toLocaleString()}
      </div>

      {parity.alerts.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Top Undercut Alerts
          </p>
          {parity.alerts.slice(0, 5).map((alert) => (
            <div
              key={`${alert.hotelName}-${alert.ota}-${alert.rate}`}
              className="rounded-lg border border-red-200/70 bg-red-50/60 px-3 py-2 text-xs dark:border-red-800/50 dark:bg-red-900/20"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{alert.hotelName}</span>
                <Badge tone={alert.severity === "high" ? "negative" : alert.severity === "medium" ? "gold" : "neutral"}>
                  {alert.severity}
                </Badge>
              </div>
              <p className="mt-1 text-red-800 dark:text-red-300">
                {alert.ota}: ${alert.rate.toFixed(0)} ({alert.deltaPct.toFixed(1)}% vs direct)
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
          No undercutting OTAs detected in the latest snapshot.
        </p>
      )}
    </Card>
  );
}
