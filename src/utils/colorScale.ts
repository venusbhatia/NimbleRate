export function getPriceColorClass(rate: number, minRate: number, maxRate: number) {
  if (maxRate === minRate) {
    return "bg-emerald-100 text-emerald-900";
  }

  const normalized = (rate - minRate) / (maxRate - minRate);

  if (normalized < 0.2) return "bg-emerald-100 text-emerald-900";
  if (normalized < 0.4) return "bg-lime-100 text-lime-900";
  if (normalized < 0.6) return "bg-amber-100 text-amber-900";
  if (normalized < 0.8) return "bg-orange-200 text-orange-900";
  return "bg-rose-200 text-rose-900";
}
