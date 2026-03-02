import { UpstreamError } from "../http.js";
import { createCloudbedsChannelManagerAdapter } from "./cloudbedsAdapter.js";
import type { ChannelManagerAdapter } from "./types.js";

export function resolveChannelManagerAdapter(provider: string | null | undefined): ChannelManagerAdapter {
  const normalized = (provider ?? "cloudbeds").trim().toLowerCase();
  if (normalized === "cloudbeds") {
    return createCloudbedsChannelManagerAdapter();
  }

  throw new UpstreamError("Unsupported channel manager provider", 400, {
    provider: normalized,
    code: "UNSUPPORTED_PROVIDER"
  });
}

