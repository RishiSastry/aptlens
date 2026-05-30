import type { PropertyFacts, UnitCandidate, UserPreferences } from "@aptlens/shared";
import { clamp, lerp } from "./math.js";
import { isKnown, numValue, buildMissingQuestions } from "./evidence.js";
import { buildCostBreakdown, costScore } from "./cost.js";
import { petScore, parkingScore } from "./dimensions.js";
import type { Viability } from "./constraints.js";

/**
 * A coarse 0–100 score from cheaply-available signals, used to order units
 * before the (expensive) floor-plan vision pass runs in Task 7.
 */
export function triageRankUnits(
  unit: UnitCandidate,
  facts: PropertyFacts | undefined,
  prefs: UserPreferences,
  viability: Viability
): number {
  if (viability === "not_viable") return 0;

  const budget = prefs.budgetMaxMonthly;
  const { knownMonthlyTotal } = buildCostBreakdown(unit, facts, prefs);

  const signals: number[] = [
    costScore(knownMonthlyTotal, budget),
    petScore(facts, prefs),
    parkingScore(facts, prefs),
  ];

  // Size / bedroom fit.
  const beds = numValue(unit.bedrooms);
  const sqft = numValue(unit.sqft);
  if (beds !== null || sqft !== null) {
    let size = 50;
    if (beds !== null) size += beds >= 2 ? 20 : beds >= 1 ? 5 : -10;
    if (sqft !== null) size = (size + clamp(lerp(sqft, 550, 1100, 30, 90))) / 2;
    signals.push(clamp(size));
  }

  // Availability vs desired move-in date.
  if (prefs.moveInBy && isKnown(unit.availableDate) && typeof unit.availableDate.value === "string") {
    const avail = Date.parse(unit.availableDate.value);
    const moveIn = Date.parse(prefs.moveInBy);
    if (!Number.isNaN(avail) && !Number.isNaN(moveIn)) {
      // Available on/before move-in is ideal; later slips the score down.
      const daysLate = (avail - moveIn) / (1000 * 60 * 60 * 24);
      signals.push(clamp(lerp(daysLate, 0, 60, 90, 20)));
    }
  }

  // A floor plan available to analyze later is a positive signal.
  signals.push(unit.floorPlanAssets.length > 0 ? 75 : 45);

  const avg = signals.reduce((a, b) => a + b, 0) / signals.length;

  // Penalize sparse data so well-documented units triage above black boxes.
  const missingCount = buildMissingQuestions(unit, facts, prefs).length;
  return clamp(avg - missingCount * 4);
}
