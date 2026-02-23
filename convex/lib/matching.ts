import type { PricingBreakdown } from "../../packages/shared/pricing";

export interface ScoreInput {
  detourMinutes: number;
  driverDetourLimit: number;
  windowOverlapMinutes: number;
  baseRouteMinutes: number;
  estimatedPrice: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function computeMatchScore(input: ScoreInput): number {
  const detourRatio = input.driverDetourLimit > 0 ? input.detourMinutes / input.driverDetourLimit : 1;
  const detourScore = 100 * (1 - clamp(detourRatio, 0, 1));

  const overlapScore = clamp(input.windowOverlapMinutes / 120, 0, 1) * 100;

  const paceScore = input.baseRouteMinutes > 0
    ? 100 * (1 - clamp(input.detourMinutes / (input.baseRouteMinutes + input.detourMinutes), 0, 1))
    : 40;

  return Math.round(detourScore * 0.55 + overlapScore * 0.25 + paceScore * 0.2);
}

export function explainRanking(score: number, pricing: PricingBreakdown): string {
  if (score >= 85) {
    return `Excellent fit, detour faible, prix estime ${pricing.totalAmount} ${pricing.currency}`;
  }
  if (score >= 70) {
    return `Bon fit, prix estime ${pricing.totalAmount} ${pricing.currency}`;
  }
  return `Compatible mais moins optimal, prix estime ${pricing.totalAmount} ${pricing.currency}`;
}

export function sizeIsCompatible(
  tripSpace: "petit" | "moyen" | "grand",
  parcelSize: "petit" | "moyen" | "grand"
): boolean {
  const rank = { petit: 1, moyen: 2, grand: 3 };
  return rank[tripSpace] >= rank[parcelSize];
}
