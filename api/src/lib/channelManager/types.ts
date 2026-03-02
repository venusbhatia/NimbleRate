export type ChannelManagerProvider = "cloudbeds";

export type RatePushMode = "dry_run" | "publish" | "rollback";

export interface RatePushItemInput {
  date: string;
  rate: number;
  currency: string;
  previousRate?: number;
}

export interface RatePushItemResult {
  date: string;
  rate: number;
  currency: string;
  success: boolean;
  attemptCount: number;
  status: "published" | "rolled_back" | "dry_run" | "failed";
  message: string;
  externalReference?: string;
}

export interface PublishRatesRequest {
  propertyId: string;
  mode: Exclude<RatePushMode, "dry_run">;
  items: RatePushItemInput[];
  idempotencyKey: string;
}

export interface ChannelManagerAdapter {
  provider: ChannelManagerProvider;
  configured: () => boolean;
  publishRates: (request: PublishRatesRequest) => Promise<RatePushItemResult[]>;
}

