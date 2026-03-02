import { randomUUID } from "node:crypto";
import { config } from "../../config.js";
import { buildUrl, fetchJson, UpstreamError } from "../http.js";
import { runProviderSerialized } from "../providerRuntime.js";
import { assertProviderBudget, incrementProviderUsage } from "../usageBudget.js";
import type {
  ChannelManagerAdapter,
  PublishRatesRequest,
  RatePushItemResult
} from "./types.js";

const MAX_ATTEMPTS = 3;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriable(error: unknown) {
  if (!(error instanceof UpstreamError)) {
    return false;
  }

  return error.status >= 500 || error.status === 429;
}

async function publishSingleRate(
  request: PublishRatesRequest,
  item: PublishRatesRequest["items"][number]
): Promise<RatePushItemResult> {
  const endpointCandidates = ["/rates", "/setRate", "/rate"];
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    for (const path of endpointCandidates) {
      const url = buildUrl(config.cloudbedsBaseUrl, path, {});
      const payload = {
        propertyID: config.cloudbedsPropertyId,
        propertyId: config.cloudbedsPropertyId,
        date: item.date,
        amount: item.rate,
        rate: item.rate,
        currency: item.currency,
        mode: request.mode
      };

      try {
        assertProviderBudget("cloudbeds");
        incrementProviderUsage("cloudbeds");
        const response = await fetchJson<Record<string, unknown>>(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${config.cloudbedsApiKey ?? ""}`,
              "x-api-key": config.cloudbedsApiKey ?? "",
              "Idempotency-Key": `${request.idempotencyKey}:${item.date}:${item.currency}`
            },
            body: JSON.stringify(payload)
          },
          "Cloudbeds rate publish failed"
        );

        return {
          date: item.date,
          rate: item.rate,
          currency: item.currency,
          success: true,
          attemptCount: attempt,
          status: request.mode === "rollback" ? "rolled_back" : "published",
          message: request.mode === "rollback" ? "Rollback push accepted by Cloudbeds." : "Rate push accepted by Cloudbeds.",
          externalReference:
            typeof response.id === "string"
              ? response.id
              : typeof response.reference === "string"
                ? response.reference
                : randomUUID()
        };
      } catch (error) {
        lastError = error;
        if (!isRetriable(error)) {
          break;
        }
      }
    }

    if (!isRetriable(lastError)) {
      break;
    }

    await delay(150 * attempt);
  }

  const apiError = lastError instanceof UpstreamError ? lastError : new UpstreamError("Cloudbeds publish failed", 502);
  return {
    date: item.date,
    rate: item.rate,
    currency: item.currency,
    success: false,
    attemptCount: MAX_ATTEMPTS,
    status: "failed",
    message: apiError.message
  };
}

export function createCloudbedsChannelManagerAdapter(): ChannelManagerAdapter {
  return {
    provider: "cloudbeds",
    configured() {
      return Boolean(config.cloudbedsApiKey && config.cloudbedsPropertyId);
    },
    async publishRates(request) {
      if (!this.configured()) {
        throw new UpstreamError("Cloudbeds channel manager is not configured", 503, {
          provider: "cloudbeds",
          code: "NOT_CONFIGURED"
        });
      }

      return runProviderSerialized("cloudbeds-channel-publish", async () => {
        const results: RatePushItemResult[] = [];
        for (const item of request.items) {
          const result = await publishSingleRate(request, item);
          results.push(result);
        }
        return results;
      });
    }
  };
}

