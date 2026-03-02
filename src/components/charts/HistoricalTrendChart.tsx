import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/Card";
import type { MarketHistoryResponse } from "../../types/history";
import { dayLabel } from "../../utils/dateUtils";

interface HistoricalTrendChartProps {
  history: MarketHistoryResponse | null;
}

export function HistoricalTrendChart({ history }: HistoricalTrendChartProps) {
  const points =
    history?.daily.map((point) => ({
      ...point,
      dateLabel: dayLabel(point.date)
    })) ?? [];

  return (
    <Card className="animate-slideUp bg-white/95 dark:bg-neutral-900/95">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Historical Market Trend</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Recommended vs anchor vs compset median ({history?.windowDays ?? 30} days)
          </p>
        </div>
      </div>

      {points.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
              <YAxis width={56} tickFormatter={(value) => `$${Math.round(Number(value ?? 0))}`} />
              <Tooltip
                formatter={(value, name) => [`$${Number(value ?? 0).toFixed(0)}`, name]}
                labelFormatter={(value) => `${value}`}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px"
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="recommendedRate" name="Recommended" stroke="#e5a93d" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="anchorRate" name="Anchor" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="compsetMedianRate" name="Compset Median" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-neutral-800/60 dark:text-gray-300">
          Historical trend data will appear after at least one completed analysis run for this market.
        </p>
      )}
    </Card>
  );
}
