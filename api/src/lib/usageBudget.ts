import { config } from "../config.js";
import type { ActiveUsageProvider, ExternalProvider, ProviderUsageRow, ProviderUsageSummary } from "../types.js";
import { executeSql, initDatabase, queryJson, sqlQuote } from "./db.js";
import { UpstreamError } from "./http.js";

const WARNING_THRESHOLD = 0.8;
const BLOCK_THRESHOLD = 0.95;

initDatabase();

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function providerQuota(provider: ExternalProvider) {
  if (provider === "makcorps") {
    return config.makcorpsDailyCallBudget;
  }
  if (provider === "predicthq") {
    return config.predictHqDailyCallBudget;
  }
  if (provider === "serpapi") {
    return config.serpApiDailyCallBudget;
  }
  if (provider === "cloudbeds") {
    return config.cloudbedsDailyCallBudget;
  }
  if (provider === "airdna") {
    return config.airdnaDailyCallBudget;
  }
  return config.amadeusFlightsDailyCallBudget;
}

function buildRecommendation(status: ProviderUsageSummary["status"], provider: ExternalProvider, remaining: number) {
  if (status === "ok") {
    return `${provider} usage is healthy. ${remaining} calls remaining today.`;
  }

  if (status === "warning") {
    return `${provider} call budget is running low. Consider reducing fetches and preparing a key/account rotation.`;
  }

  return `${provider} call budget is critical. Rotate account/key before continuing high-frequency analysis.`;
}

export function incrementProviderUsage(provider: ExternalProvider, amount = 1) {
  const day = todayIsoDate();
  const quota = providerQuota(provider);

  executeSql(`
    INSERT INTO provider_usage(provider, day, calls, quota)
    VALUES (${sqlQuote(provider)}, ${sqlQuote(day)}, ${amount}, ${quota})
    ON CONFLICT(provider, day) DO UPDATE SET
      calls = provider_usage.calls + ${amount},
      quota = ${quota};
  `);
}

function getProviderRow(provider: ExternalProvider): ProviderUsageRow {
  const day = todayIsoDate();
  const quota = providerQuota(provider);

  const rows = queryJson<ProviderUsageRow>(`
    SELECT provider, day, calls, quota
    FROM provider_usage
    WHERE provider = ${sqlQuote(provider)}
      AND day = ${sqlQuote(day)}
    LIMIT 1;
  `);

  if (!rows.length) {
    return { provider, day, calls: 0, quota };
  }

  return {
    provider,
    day: rows[0].day,
    calls: Number(rows[0].calls ?? 0),
    quota: Number(rows[0].quota ?? quota)
  };
}

function toSummary(row: ProviderUsageRow): ProviderUsageSummary {
  const quota = Math.max(1, Number(row.quota || 0));
  const calls = Math.max(0, Number(row.calls || 0));
  const percentUsed = Math.min(100, Math.round((calls / quota) * 10000) / 100);
  const remaining = Math.max(0, quota - calls);

  let status: ProviderUsageSummary["status"] = "ok";
  if (calls / quota >= BLOCK_THRESHOLD) {
    status = "critical";
  } else if (calls / quota >= WARNING_THRESHOLD) {
    status = "warning";
  }

  return {
    provider: row.provider,
    day: row.day,
    calls,
    quota,
    remaining,
    percentUsed,
    status,
    recommendation: buildRecommendation(status, row.provider, remaining)
  };
}

export function getProviderUsage(provider: ExternalProvider): ProviderUsageSummary {
  return toSummary(getProviderRow(provider));
}

export function assertProviderBudget(provider: ExternalProvider, critical = false) {
  const usage = getProviderUsage(provider);
  if (!critical && usage.status === "critical") {
    throw new UpstreamError(
      `${provider} daily call budget reached critical threshold`,
      429,
      {
        provider,
        usage
      }
    );
  }
}

export function getUsageSummary() {
  const activeProviders: ActiveUsageProvider[] = [
    "makcorps",
    "predicthq",
    "serpapi",
    "amadeus_flights"
  ];
  const details = activeProviders.map((provider) => getProviderUsage(provider));

  return {
    day: todayIsoDate(),
    providers: details,
    overallStatus: details.some((entry) => entry.status === "critical")
      ? "critical"
      : details.some((entry) => entry.status === "warning")
        ? "warning"
        : "ok"
  } as const;
}
