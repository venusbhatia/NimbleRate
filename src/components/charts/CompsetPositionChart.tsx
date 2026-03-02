import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/Card";

interface CompsetPositionChartProps {
  rates: number[];
  recommendedRate: number;
  p25: number;
  median: number;
  p75: number;
}

export function CompsetPositionChart({
  rates,
  recommendedRate,
  p25,
  median,
  p75
}: CompsetPositionChartProps) {
  const sortedRates = [...rates]
    .filter((rate) => Number.isFinite(rate) && rate > 0)
    .sort((a, b) => a - b);
  const data = sortedRates.map((rate, index) => ({
    hotel: `H${index + 1}`,
    rate
  }));

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Compset Positioning</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Recommended vs P25/P50/P75 competitor rate band
          </p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {data.length} samples
        </span>
      </div>

      {data.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hotel" tick={{ fontSize: 11 }} />
              <YAxis
                width={56}
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `$${Math.round(Number(value ?? 0))}`}
              />
              <Tooltip
                formatter={(value) => [`$${Number(value ?? 0).toFixed(0)}`, "Compset Rate"]}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px"
                }}
              />
              <ReferenceLine y={p25} stroke="#34d399" strokeDasharray="4 4" label={{ value: "P25", fontSize: 10, fill: "#059669" }} />
              <ReferenceLine y={median} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "P50", fontSize: 10, fill: "#b45309" }} />
              <ReferenceLine y={p75} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "P75", fontSize: 10, fill: "#be123c" }} />
              <ReferenceLine
                y={recommendedRate}
                stroke="#1f2937"
                strokeWidth={2}
                label={{ value: "Recommended", fontSize: 10, fill: "#111827", position: "insideTopRight" }}
              />
              <Bar dataKey="rate" fill="#e5a93d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-neutral-800/60 dark:text-gray-300">
          No valid compset rate data available. Run analysis to load competitor rates.
        </p>
      )}
    </Card>
  );
}
