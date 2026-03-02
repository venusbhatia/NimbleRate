import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./apiClient";

describe("apiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses backend JSON message as ApiError message and preserves details", async () => {
    const payload = {
      message: "Ticketmaster API request failed",
      status: 502,
      details: { reason: "rate limited" }
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    );

    let thrown: unknown;
    try {
      await apiFetch("https://example.com/api/events");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);

    const apiError = thrown as ApiError;
    expect(apiError.status).toBe(502);
    expect(apiError.message).toBe(payload.message);
    expect(apiError.details).toEqual(payload);
  });

  it("uses plain text body as ApiError message", async () => {
    const text = "Service unavailable";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(text, {
        status: 503,
        headers: { "Content-Type": "text/plain" }
      })
    );

    await expect(apiFetch("https://example.com/api/weather")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: text
    });
  });
});
