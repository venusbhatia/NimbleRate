export interface MarketHistoryDailyPoint {
  date: string;
  recommendedRate: number;
  anchorRate: number;
  confidence: "high" | "medium" | "low";
  compsetMedianRate: number;
  compsetSampleSize: number;
}

export interface MarketHistorySummary {
  recommendedAvg: number;
  recommendedTrendPct: number;
  compsetAvg: number;
  volatilityPct: number;
}

export interface MarketHistoryResponse {
  marketKey: string;
  windowDays: number;
  daily: MarketHistoryDailyPoint[];
  summary: MarketHistorySummary;
}
