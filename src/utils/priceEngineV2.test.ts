import { describe, expect, it } from "vitest";
import { confidenceTone, formatCompsetDelta, percentileBandLabel } from "./priceEngineV2";

describe("priceEngineV2 display helpers", () => {
  it("formats compset deltas", () => {
    expect(formatCompsetDelta(0)).toBe("$0 vs compset median");
    expect(formatCompsetDelta(18.4)).toBe("+$18 vs compset median");
    expect(formatCompsetDelta(-11.6)).toBe("-$12 vs compset median");
  });

  it("maps percentile labels", () => {
    expect(percentileBandLabel("below_p25")).toBe("Below P25");
    expect(percentileBandLabel("mid_band")).toBe("Within P25-P75");
    expect(percentileBandLabel("above_p75")).toBe("Above P75");
  });

  it("maps recommendation confidence tone", () => {
    expect(confidenceTone("high")).toBe("positive");
    expect(confidenceTone("medium")).toBe("gold");
    expect(confidenceTone("low")).toBe("negative");
  });
});
