import type { PropertyFacts, UnitCandidate, UserPreferences } from "@aptlens/shared";
import { isKnown } from "./evidence.js";
import { buildCostBreakdown } from "./cost.js";
import { parkingUnavailable } from "./dimensions.js";

export type Viability = NonNullable<UnitCandidate["viability"]>;

/**
 * Eliminate units that violate a *confirmed* hard constraint. Unknowns never
 * eliminate — they downgrade to `maybe_viable_needs_clarification`.
 */
export function filterUnitsByHardConstraints(
  units: UnitCandidate[],
  factsById: Map<string, PropertyFacts | undefined>,
  prefs: UserPreferences
): Map<string, Viability> {
  const result = new Map<string, Viability>();
  const budget = prefs.budgetMaxMonthly;

  for (const unit of units) {
    const facts = factsById.get(unit.propertyId);
    let hasUnknown = false;

    // Pet: confirmed not allowed → out.
    if (prefs.pet.hasPet) {
      const allowed = facts?.petAllowed;
      if (isKnown(allowed) && allowed.value === false) {
        result.set(unit.unitId, "not_viable");
        continue;
      }
      if (!isKnown(allowed)) hasUnknown = true;
    }

    // Budget: known total over budget by a meaningful margin (>5%) → out.
    const { knownMonthlyTotal } = buildCostBreakdown(unit, facts, prefs);
    if (budget !== undefined) {
      if (knownMonthlyTotal !== null && knownMonthlyTotal > budget * 1.05) {
        result.set(unit.unitId, "not_viable");
        continue;
      }
      if (knownMonthlyTotal === null) hasUnknown = true;
    }

    // Parking: required + confirmed unavailable → out.
    if (prefs.parking === "required") {
      if (parkingUnavailable(facts)) {
        result.set(unit.unitId, "not_viable");
        continue;
      }
      if (!isKnown(facts?.parkingPolicy) && !isKnown(facts?.parkingFee)) hasUnknown = true;
    }

    result.set(unit.unitId, hasUnknown ? "maybe_viable_needs_clarification" : "viable");
  }

  return result;
}
