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
        <h3 className="text-lg font-semibold tracking-tight">30-Day Price Trend</h3>
      </div>
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
    </Card>
  );
}
