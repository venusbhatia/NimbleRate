export interface PmsProviderHealth {
  provider: "simulated" | "cloudbeds";
  configured: boolean;
  message: string;
}

export interface PmsHealthResponse {
  selectedProvider: "simulated";
  activeMode: "simulated";
  fallbackEnabled: boolean;
  generatedAt: string;
  providers: PmsProviderHealth[];
}

export interface StrSupplyResponse {
  propertyId: string;
  marketKey: string;
  source: "fallback_proxy";
  status: "ok" | "neutral_fallback";
  supplyPressureIndex: number;
  recommendedMultiplier: number;
  activeListingsEstimate: number;
  trend: "rising" | "falling" | "stable" | "unknown";
  trendPct?: number;
  daysForward: number;
  warning?: string;
}

export interface PortfolioSummaryProperty {
  propertyId: string;
  analysisPoints: number;
  analysisRuns: number;
  adrAvg: number;
  occupancyAvg: number;
  revparAvg: number;
  lastRunAt: string;
}

export interface PortfolioSummaryResponse {
  windowDays: number;
  propertyCount: number;
  totals: {
    analysisRuns: number;
    adrAvg: number;
    occupancyAvg: number;
    revparAvg: number;
  };
  properties: PortfolioSummaryProperty[];
}

export interface PaceAnomaly {
  date: string;
  occupancy: number;
  baseline: number;
  delta: number;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface PaceAnomaliesResponse {
  propertyId: string;
  marketKey: string;
  windowDays: number;
  baselineMethod: string;
  anomalies: PaceAnomaly[];
}

export interface RevenueAnalyticsPoint {
  date: string;
  adr: number;
  anchorRate: number;
  occupancy: number;
  revpar: number;
}

export interface RevenueAnalyticsResponse {
  propertyId: string;
  marketKey: string;
  windowDays: number;
  daily: RevenueAnalyticsPoint[];
  summary: {
    adrAvg: number;
    revparAvg: number;
    occupancyAvg: number;
    adrTrendPct: number;
    revparTrendPct: number;
    volatilityPct: number;
  };
}

export interface PropertyRecord {
  propertyId: string;
  name: string;
  countryCode: string;
  cityName: string;
  latitude: number | null;
  longitude: number | null;
  hotelType: "city" | "business" | "leisure" | "beach" | "ski";
  totalRooms: number;
  channelProvider: string;
  createdAt: string;
  updatedAt: string;
}

export interface PropertiesListResponse {
  generatedAt: string;
  properties: PropertyRecord[];
}

export interface PropertiesMutationResponse {
  created?: boolean;
  updated?: boolean;
  property: PropertyRecord;
}

export interface RatePushJobSummary {
  id: number;
  propertyId: string;
  marketKey: string;
  mode: "dry_run" | "publish" | "rollback";
  status: "queued" | "approved" | "publishing" | "completed" | "failed" | "rolled_back";
  idempotencyKey: string | null;
  requestedBy: string;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  rollbackJobId: number | null;
}

export interface RatePushJobListResponse {
  propertyId: string;
  jobs: RatePushJobSummary[];
}

export interface RatePushRequest {
  propertyId?: string;
  marketKey: string;
  mode: "dry_run" | "publish" | "rollback";
  manualApproval: boolean;
  idempotencyKey?: string;
  requestedBy?: string;
  notes?: string;
  rollbackJobId?: number;
  rates: Array<{
    date: string;
    rate: number;
    currency?: string;
    previousRate?: number;
  }>;
}

export interface RatePushResponse {
  jobId: number;
  propertyId: string;
  marketKey: string;
  mode: "dry_run" | "publish" | "rollback";
  status: string;
  manualApproval: boolean;
  simulated: boolean;
  idempotencyKey: string;
  ratesCount: number;
  rollbackJobId: number | null;
  duplicate?: boolean;
  failedCount?: number;
  message: string;
}

export interface RatePushJobDetailsResponse {
  job: {
    id: number;
    propertyId: string;
    marketKey: string;
    mode: "dry_run" | "publish" | "rollback";
    status: string;
    idempotencyKey: string | null;
    requestedBy: string;
    requestedAt: string;
    approvedAt: string | null;
    completedAt: string | null;
    rollbackJobId: number | null;
    notes: string | null;
    payload: unknown;
  };
  items: Array<{
    id: number;
    date: string;
    rate: number;
    previousRate: number | null;
    currency: string;
    status: string;
    externalReference: string | null;
    attemptCount: number;
    message: string | null;
    createdAt: string;
  }>;
}
