import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParitySummaryCard } from "./ParitySummaryCard";

describe("ParitySummaryCard", () => {
  it("renders empty-state guidance when parity data is missing", () => {
    const html = renderToStaticMarkup(<ParitySummaryCard parity={null} directRate={229} />);
    expect(html).toContain("Rate Parity Monitor");
    expect(html).toContain("Run analysis");
  });

  it("renders risk and alert rows when parity data is present", () => {
    const html = renderToStaticMarkup(
      <ParitySummaryCard
        directRate={229}
        parity={{
          marketKey: "austin-us",
          directRate: 229,
          tolerancePct: 2,
          snapshotAt: new Date().toISOString(),
          summary: {
            undercutCount: 2,
            parityCount: 1,
            overcutCount: 1,
            undercutPct: 50,
            minRate: 180,
            medianRate: 220,
            maxRate: 250,
            riskLevel: "medium"
          },
          alerts: [
            {
              hotelName: "Hotel A",
              ota: "booking",
              rate: 180,
              delta: -49,
              deltaPct: -21.4,
              severity: "high"
            }
          ]
        }}
      />
    );

    expect(html).toContain("medium risk");
    expect(html).toContain("Top Undercut Alerts");
    expect(html).toContain("Hotel A");
  });
});
