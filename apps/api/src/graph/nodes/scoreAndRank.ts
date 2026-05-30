import type { PropertyCandidate, PropertyFacts, RankedUnitCard } from "@aptlens/shared";
import { computeOverallScore, weightsFromPreferences } from "@aptlens/shared/scoring";
import type { PipelineState } from "../state.js";
import { clamp } from "./scoring/math.js";
import { numValue, isKnown, buildEvidence, evidenceCompletenessScore, buildMissingQuestions } from "./scoring/evidence.js";
import { buildCostBreakdown, budgetStatus, costScore } from "./scoring/cost.js";
import { petScore, petCompatStatus, parkingScore, wfhScore, storageScore } from "./scoring/dimensions.js";
import { filterUnitsByHardConstraints, type Viability } from "./scoring/constraints.js";
import { triageRankUnits } from "./scoring/triage.js";
import { tourPriorityFor, buildTopReasons, buildRisks } from "./scoring/cards.js";

/**
 * Task 4 — scoring & comparison logic.
 *   1. filterUnitsByHardConstraints  → viability
 *   2. triageRankUnits               → pre-vision triage score
 *   3. computeFinalScores            → weighted overall score + ranked cards
 * The heavy lifting lives in ./scoring/*; this node just orchestrates it.
 */
export async function scoreAndRank(state: PipelineState): Promise<PipelineState> {
  const { units, properties, request } = state;
  const prefs = request.preferences;
  const weights = weightsFromPreferences(prefs);
  const budget = prefs.budgetMaxMonthly;

  const factsById = new Map<string, PropertyFacts | undefined>(
    properties.map((p: PropertyCandidate) => [p.propertyId, p.propertyFacts])
  );

  console.log(
    `[scoreAndRank] Scoring ${units.length} units against ${properties.length} properties`
  );

  // 1. Hard constraints.
  const viabilityById = filterUnitsByHardConstraints(units, factsById, prefs);

  // 2 + 3. Score each unit.
  const cards: RankedUnitCard[] = units.map((unit) => {
    const facts = factsById.get(unit.propertyId);
    const viability = viabilityById.get(unit.unitId) ?? "maybe_viable_needs_clarification";

    const { breakdown, knownMonthlyTotal } = buildCostBreakdown(unit, facts, prefs);
    const evidence = buildEvidence(unit, facts, prefs);
    const missingQuestions = buildMissingQuestions(unit, facts, prefs);

    const scores: RankedUnitCard["scores"] = {
      cost: costScore(knownMonthlyTotal, budget),
      petFit: petScore(facts, prefs),
      wfhFit: wfhScore(unit, prefs),
      parking: parkingScore(facts, prefs),
      storage: storageScore(unit),
      evidenceCompleteness: evidenceCompletenessScore(evidence),
    };

    let overallScore = clamp(computeOverallScore(scores, weights));
    if (viability === "not_viable") overallScore = clamp(overallScore * 0.4); // sink to bottom

    const tourPriority = tourPriorityFor(overallScore, viability);

    // Annotate the source unit so downstream nodes (and Task 7) can read it.
    unit.viability = viability;
    unit.preVisionScore = triageRankUnits(unit, facts, prefs, viability);
    unit.finalScore = overallScore;
    unit.tourPriority = tourPriority;

    return {
      unitId: unit.unitId,
      propertyId: unit.propertyId,
      propertyName: unit.propertyName,
      unitName: unit.unitName,
      floorPlanName: unit.floorPlanName,
      rank: 0, // assigned after sort
      overallScore,
      trueMonthlyCostKnown: knownMonthlyTotal ?? undefined,
      budgetStatus: budgetStatus(knownMonthlyTotal, budget),
      tourPriority,
      scores,
      costBreakdown: breakdown,
      floorPlanSignals: {
        bedroomDimensions: undefined,
        livingRoomDimensions: undefined,
        queenBedFit: unit.floorPlanAnalysis ? "likely" : "missing",
        deskFit: unit.floorPlanAnalysis ? "likely" : "missing",
        floorPlanConfidence: unit.floorPlanAnalysis?.confidence ?? "low",
      },
      petSignals: {
        petAllowed: petCompatStatus(facts),
        petRent: numValue(facts?.petRent) ?? undefined,
        petDeposit: numValue(facts?.petDeposit) ?? undefined,
        weightLimit: isKnown(facts?.petWeightLimit) ? String(facts!.petWeightLimit.value) : undefined,
        breedRestrictions: facts?.breedRestrictions?.status ?? "missing",
      },
      topReasons: buildTopReasons(scores, breakdown, budget, prefs),
      risks: buildRisks(viability, scores, missingQuestions),
      missingQuestions,
      evidence,
    } satisfies RankedUnitCard;
  });

  // Rank: best overall first; not-viable units sink below everything else.
  const viabilityRank: Record<Viability, number> = {
    viable: 0,
    maybe_viable_needs_clarification: 1,
    not_viable: 2,
  };
  cards.sort((a, b) => {
    const va = viabilityById.get(a.unitId) ?? "maybe_viable_needs_clarification";
    const vb = viabilityById.get(b.unitId) ?? "maybe_viable_needs_clarification";
    if (va !== vb && (va === "not_viable" || vb === "not_viable")) {
      return viabilityRank[va] - viabilityRank[vb];
    }
    return b.overallScore - a.overallScore;
  });
  cards.forEach((card, i) => (card.rank = i + 1));

  return { ...state, rankedUnits: cards };
}
