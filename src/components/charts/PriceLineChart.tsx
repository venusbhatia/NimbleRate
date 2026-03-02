import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/Card";
import type { PricingRecommendation } from "../../types/pricing";
import { dayLabel } from "../../utils/dateUtils";

interface PriceLineChartProps {
  data: PricingRecommendation[];
}

export function PriceLineChart({ data }: PriceLineChartProps) {
  return (
    <Card className="animate-slideUp">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Rate Trend</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">30 days</span>
      </div>
      {data.length ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.map((item) => ({
                ...item,
                dateLabel: dayLabel(item.date)
              }))}
            >
              <XAxis dataKey="dateLabel" hide />
              <YAxis width={56} tickFormatter={(value) => `$${Math.round(value)}`} />
              <Tooltip
                formatter={(value) => [`$${Number(value ?? 0).toFixed(0)}`, "Recommended Rate"]}
                labelFormatter={(value) => `${value}`}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px"
                }}
              />
              <Line
                type="monotone"
                dataKey="finalRate"
                stroke="#e5a93d"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#c47f20" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="rounded-xl border border-gray-200/80 bg-gray-50/80 px-3 py-8 text-sm text-gray-500 dark:border-gray-700 dark:bg-neutral-800/60 dark:text-gray-300">
          No rate trend data available. Run analysis to generate pricing recommendations.
        </p>
      )}
    </Card>
  );
}
