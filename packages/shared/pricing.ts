export type DetourBracket = "0-5" | "6-10" | "11-20" | "21-30" | "30+";

export interface PricingInput {
  baseDistanceKm: number;
  weightKg: number;
  volumeDm3: number;
  detourMinutes: number;
  urgencyLevel: "normal" | "urgent" | "express";
  fragile: boolean;
  insuranceValue?: number;
}

export interface PricingRules {
  currency: string;
  baseFee: number;
  perKm: number;
  perKg: number;
  perVolumeDm3: number;
  detourByBracket: Record<DetourBracket, number>;
  urgentFee: number;
  expressFee: number;
  fragileFee: number;
  insuranceRate: number;
  minPrice: number;
  maxPrice: number;
}

export interface PricingBreakdown {
  currency: string;
  baseAmount: number;
  distanceAmount: number;
  weightAmount: number;
  volumeAmount: number;
  detourAmount: number;
  urgencyAmount: number;
  fragileAmount: number;
  insuranceAmount: number;
  subtotal: number;
  floorApplied: boolean;
  ceilApplied: boolean;
  totalAmount: number;
  detourBracket: DetourBracket;
}

export const defaultPricingRules: PricingRules = {
  currency: "EUR",
  baseFee: 4,
  perKm: 0.35,
  perKg: 0.45,
  perVolumeDm3: 0.06,
  detourByBracket: {
    "0-5": 1.5,
    "6-10": 3,
    "11-20": 6,
    "21-30": 10,
    "30+": 15,
  },
  urgentFee: 3,
  expressFee: 7,
  fragileFee: 2.5,
  insuranceRate: 0.015,
  minPrice: 6,
  maxPrice: 180,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function getDetourBracket(detourMinutes: number): DetourBracket {
  if (detourMinutes <= 5) return "0-5";
  if (detourMinutes <= 10) return "6-10";
  if (detourMinutes <= 20) return "11-20";
  if (detourMinutes <= 30) return "21-30";
  return "30+";
}

export function computeDynamicPrice(
  input: PricingInput,
  rules: PricingRules = defaultPricingRules
): PricingBreakdown {
  const detourBracket = getDetourBracket(input.detourMinutes);
  const baseAmount = rules.baseFee;
  const distanceAmount = input.baseDistanceKm * rules.perKm;
  const weightAmount = input.weightKg * rules.perKg;
  const volumeAmount = input.volumeDm3 * rules.perVolumeDm3;
  const detourAmount = rules.detourByBracket[detourBracket];
  const urgencyAmount =
    input.urgencyLevel === "express"
      ? rules.expressFee
      : input.urgencyLevel === "urgent"
        ? rules.urgentFee
        : 0;
  const fragileAmount = input.fragile ? rules.fragileFee : 0;
  const insuranceAmount = input.insuranceValue
    ? input.insuranceValue * rules.insuranceRate
    : 0;

  const subtotal =
    baseAmount +
    distanceAmount +
    weightAmount +
    volumeAmount +
    detourAmount +
    urgencyAmount +
    fragileAmount +
    insuranceAmount;

  const floorApplied = subtotal < rules.minPrice;
  const ceilApplied = subtotal > rules.maxPrice;
  const bounded = Math.max(rules.minPrice, Math.min(subtotal, rules.maxPrice));

  return {
    currency: rules.currency,
    baseAmount: round2(baseAmount),
    distanceAmount: round2(distanceAmount),
    weightAmount: round2(weightAmount),
    volumeAmount: round2(volumeAmount),
    detourAmount: round2(detourAmount),
    urgencyAmount: round2(urgencyAmount),
    fragileAmount: round2(fragileAmount),
    insuranceAmount: round2(insuranceAmount),
    subtotal: round2(subtotal),
    floorApplied,
    ceilApplied,
    totalAmount: round2(bounded),
    detourBracket,
  };
}
