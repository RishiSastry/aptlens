import type { PropertyFacts, RankedUnitCard, UnitCandidate, UserPreferences } from "@aptlens/shared";
import { clamp, lerp } from "./math.js";
import { numValue } from "./evidence.js";

export type CostBreakdown = RankedUnitCard["costBreakdown"];

/** Assemble the known + unknown monthly cost components for a unit. */
export function buildCostBreakdown(
  unit: UnitCandidate,
  facts: PropertyFacts | undefined,
  prefs: UserPreferences
): { breakdown: CostBreakdown; knownMonthlyTotal: number | null } {
  const baseRent = numValue(unit.rent);
  const parkingFee = prefs.parking === "not_needed" ? 0 : numValue(facts?.parkingFee);
  const petRent = prefs.pet.hasPet ? numValue(facts?.petRent) : 0;
  const amenityFee = numValue(facts?.amenityFee);

  const unknownCostFields: string[] = [];
  if (baseRent === null) unknownCostFields.push("rent");
  if (prefs.parking !== "not_needed" && parkingFee === null) unknownCostFields.push("parking");
  if (prefs.pet.hasPet && petRent === null) unknownCostFields.push("pet rent");
  if (amenityFee === null) unknownCostFields.push("amenity fee");

  // Only meaningful once base rent is known; otherwise the total is unknowable.
  const knownMonthlyTotal =
    baseRent === null ? null : baseRent + (parkingFee ?? 0) + (petRent ?? 0) + (amenityFee ?? 0);

  const breakdown: CostBreakdown = {
    baseRent: baseRent ?? undefined,
    parkingFee: parkingFee ?? undefined,
    petRent: petRent ?? undefined,
    amenityFee: amenityFee ?? undefined,
    knownMonthlyTotal: knownMonthlyTotal ?? undefined,
    unknownCostFields,
  };

  return { breakdown, knownMonthlyTotal };
}

export function budgetStatus(
  knownMonthlyTotal: number | null,
  budget: number | undefined
): RankedUnitCard["budgetStatus"] {
  if (knownMonthlyTotal === null || budget === undefined) return "unknown";
  if (knownMonthlyTotal <= budget) return "within_budget";
  if (knownMonthlyTotal <= budget * 1.05) return "near_budget";
  return "over_budget";
}

/** 0–100 cost-fit score. Cheaper relative to budget scores higher. */
export function costScore(knownMonthlyTotal: number | null, budget: number | undefined): number {
  if (knownMonthlyTotal === null) return 40; // unknown cost — moderate penalty, not zero
  if (budget === undefined) return 60; // rent known but no budget to judge against
  const ratio = knownMonthlyTotal / budget;
  // ratio <= 0.75 → 100, ratio >= 1.25 → 0, linear between.
  return clamp(lerp(ratio, 1.25, 0.75, 0, 100));
}
