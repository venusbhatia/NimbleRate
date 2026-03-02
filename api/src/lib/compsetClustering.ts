export interface CompsetCandidateInput {
  hotelId: string;
  hotelName: string;
  latitude?: number;
  longitude?: number;
  averageRate: number;
  sampleSize: number;
  starRating?: number;
}

export interface CompsetSuggestion {
  hotelId: string;
  hotelName: string;
  score: number;
  confidence: "high" | "medium" | "low";
  distanceKm: number | null;
  features: {
    geodistance: number;
    rateBand: number;
    demandSimilarity: number;
  };
  explanation: string;
}

export interface CompsetClusteringInput {
  latitude: number;
  longitude: number;
  anchorRate: number;
  demandIndex: number;
  maxResults: number;
  candidates: CompsetCandidateInput[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function confidenceFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

export function suggestCompsetCandidates(input: CompsetClusteringInput): CompsetSuggestion[] {
  const normalizedAnchor = Math.max(1, input.anchorRate);
  const normalizedDemand = clamp(input.demandIndex, 0, 100);

  const scored = input.candidates
    .filter((candidate) => Number.isFinite(candidate.averageRate) && candidate.averageRate > 0)
    .map((candidate) => {
      const hasGeo = Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
      const distanceKm = hasGeo
        ? haversineKm(input.latitude, input.longitude, candidate.latitude as number, candidate.longitude as number)
        : null;
      const geodistance = distanceKm === null ? 0.45 : clamp(1 - distanceKm / 15, 0, 1);

      const rateDiffRatio = Math.abs(candidate.averageRate - normalizedAnchor) / normalizedAnchor;
      const rateBand = clamp(1 - rateDiffRatio / 0.6, 0, 1);

      const demandProxy = clamp((candidate.sampleSize / 30) * 100, 0, 100);
      const demandSimilarity = clamp(1 - Math.abs(demandProxy - normalizedDemand) / 100, 0, 1);

      const score = clamp(
        Math.round((geodistance * 0.45 + rateBand * 0.35 + demandSimilarity * 0.2) * 100),
        0,
        100
      );

      const explanation = [
        `Geo fit ${Math.round(geodistance * 100)}%`,
        `rate-band fit ${Math.round(rateBand * 100)}%`,
        `demand-fit ${Math.round(demandSimilarity * 100)}%`
      ].join(", ");

      return {
        hotelId: candidate.hotelId,
        hotelName: candidate.hotelName,
        score,
        confidence: confidenceFromScore(score),
        distanceKm: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
        features: {
          geodistance: Number(geodistance.toFixed(3)),
          rateBand: Number(rateBand.toFixed(3)),
          demandSimilarity: Number(demandSimilarity.toFixed(3))
        },
        explanation
      } satisfies CompsetSuggestion;
    })
    .sort((a, b) => b.score - a.score || a.hotelName.localeCompare(b.hotelName));

  return scored.slice(0, Math.max(1, input.maxResults));
}

