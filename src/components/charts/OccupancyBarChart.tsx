import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "../ui/Card";
import type { PricingRecommendation } from "../../types/pricing";

interface OccupancyBarChartProps {
  data: PricingRecommendation[];
}

export function OccupancyBarChart({ data }: OccupancyBarChartProps) {
  return (
    <Card className="animate-slideUp">
      <h3 className="mb-4 text-lg font-semibold tracking-tight">Multiplier vs Rate</h3>
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
            <XAxis dataKey="day" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Bar yAxisId="left" dataKey="multiplier" fill="#059669" radius={[6, 6, 0, 0]} />
            <Bar yAxisId="right" dataKey="rate" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
