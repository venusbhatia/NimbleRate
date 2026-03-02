import type { DashboardModel } from "../types/dashboard";

export function formatCompsetDelta(deltaVsMedian: number) {
  const rounded = Math.round(Math.abs(deltaVsMedian));
  if (deltaVsMedian === 0) return "$0 vs compset median";
  return `${deltaVsMedian > 0 ? "+$" : "-$"}${rounded} vs compset median`;
}

export function percentileBandLabel(
  band: DashboardModel["compsetPosition"]["percentileBand"]
) {
  if (band === "below_p25") return "Below P25";
  if (band === "above_p75") return "Above P75";
  return "Within P25-P75";
}

export function confidenceTone(level: DashboardModel["recommendationConfidence"]["level"]) {
  if (level === "high") return "positive";
  if (level === "medium") return "gold";
  return "negative";
}
