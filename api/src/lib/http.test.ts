import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./http.js";

describe("fetchJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses vendor +json payloads", async () => {
    const payload = { data: [{ hotelId: "HXTEST01" }] };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.amadeus+json"
        }
      })
    );

    const result = await fetchJson<typeof payload>("https://example.com/hotels");
    expect(result).toEqual(payload);
  });

  it("parses nested JSON strings from upstream payloads", async () => {
    const payload = { data: [{ hotelId: "HXTEST01" }] };
    const nested = JSON.stringify(payload);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(nested), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.amadeus+json"
        }
      })
    );

    const result = await fetchJson<typeof payload>("https://example.com/hotels");
    expect(result).toEqual(payload);
  });

  it("keeps plain text payloads as strings", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      })
    );

    const result = await fetchJson<string>("https://example.com/health");
    expect(result).toBe("ok");
  });

  it("parses JSON-looking text payloads", async () => {
    const payload = { data: [{ hotelId: "HXTEST01" }] };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(JSON.stringify(payload)), {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      })
    );

    const result = await fetchJson<typeof payload>("https://example.com/hotels");
    expect(result).toEqual(payload);
  });
});
