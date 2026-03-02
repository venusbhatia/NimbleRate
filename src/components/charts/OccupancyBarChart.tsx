import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/Card";
import type { PricingRecommendation } from "../../types/pricing";

interface OccupancyBarChartProps {
  data: PricingRecommendation[];
}

export function OccupancyBarChart({ data }: OccupancyBarChartProps) {
  return (
    <Card className="animate-slideUp">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Price Factors Over Time</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Adjustment
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" /> Rate ($)
          </span>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.slice(0, 14).map((item) => ({
              day: item.date.slice(5),
              multiplier: Number(item.finalMultiplier.toFixed(2)),
              rate: Math.round(item.finalRate)
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                fontSize: "13px"
              }}
            />
            <Bar yAxisId="left" dataKey="multiplier" name="Adjustment" fill="#059669" radius={[6, 6, 0, 0]} />
            <Bar yAxisId="right" dataKey="rate" name="Rate ($)" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
