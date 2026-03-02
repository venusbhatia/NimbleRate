export type ParityRiskLevel = "low" | "medium" | "high";
export type ParityAlertSeverity = "low" | "medium" | "high";

export interface ParitySummaryMetrics {
  undercutCount: number;
  parityCount: number;
  overcutCount: number;
  undercutPct: number;
  minRate: number;
  medianRate: number;
  maxRate: number;
  riskLevel: ParityRiskLevel;
}

export interface ParityAlert {
  hotelName: string;
  ota: string;
  rate: number;
  delta: number;
  deltaPct: number;
  severity: ParityAlertSeverity;
}

export interface ParitySummaryResponse {
  propertyId: string;
  marketKey: string;
  directRate: number;
  tolerancePct: number;
  snapshotAt: string;
  summary: ParitySummaryMetrics;
  alerts: ParityAlert[];
}
