import { config } from "../config.js";
import { buildUrl, fetchJson } from "./http.js";

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

export async function getAmadeusAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.amadeusApiKey,
    client_secret: config.amadeusApiSecret
  });

  const tokenResponse = await fetchJson<{ access_token: string; expires_in: number }>(
    `${config.amadeusBaseUrl}/v1/security/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    },
    "Failed to authenticate with Amadeus"
  );

  tokenCache = {
    accessToken: tokenResponse.access_token,
    expiresAt: Date.now() + Math.max(1, tokenResponse.expires_in - 60) * 1000
  };

  return tokenCache.accessToken;
}

export async function amadeusGet<T>(path: string, params: Record<string, string | number | boolean | undefined>) {
  const token = await getAmadeusAccessToken();
  const url = buildUrl(config.amadeusBaseUrl, path, params);

  return fetchJson<T>(
    url,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    "Amadeus API request failed"
  );
}
