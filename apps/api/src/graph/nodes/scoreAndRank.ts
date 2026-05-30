import type { RankedUnitCard } from "@aptlens/shared";
import { weightsFromPreferences } from "@aptlens/shared/scoring";
import type { PipelineState } from "../state.js";

// TODO (Task 4): implement real scoring logic —
//   filterUnitsByHardConstraints, triageRankUnits, computeFinalScores
export async function scoreAndRank(state: PipelineState): Promise<PipelineState> {
  const { units, request } = state;
  const weights = weightsFromPreferences(request.preferences);

  console.log(`[scoreAndRank] Scoring ${units.length} units (stub — Task 4 implements real logic)`);

  const rankedUnits: RankedUnitCard[] = units.map((unit, i) => {
    // Stub: neutral scores until Task 4 fills in real logic
    const scores = {
      cost:                 50,
      petFit:               50,
      wfhFit:               50,
      parking:              50,
      storage:              50,
      evidenceCompleteness: 10, // all fields missing → low completeness
    };

    const overallScore = Math.round(
      scores.cost                 * weights.cost +
      scores.petFit               * weights.petFit +
      scores.wfhFit               * weights.wfhFit +
      scores.parking              * weights.parking +
      scores.storage              * weights.storage +
      scores.evidenceCompleteness * weights.evidenceCompleteness
    );

    return {
      unitId:       unit.unitId,
      propertyId:   unit.propertyId,
      propertyName: unit.propertyName,
      unitName:     unit.unitName,
      rank:         i + 1,
      overallScore,
      budgetStatus: "unknown",
      tourPriority: "ask_before_touring",
      scores,
      costBreakdown: {
        unknownCostFields: ["rent", "parking", "pet rent", "utilities"],
      },
      floorPlanSignals: {
        queenBedFit:          "missing",
        deskFit:              "missing",
        floorPlanConfidence:  "low",
      },
      petSignals: {
        petAllowed:       "missing",
        breedRestrictions: "missing",
      },
      topReasons:       ["Insufficient data — awaiting crawl and extraction"],
      risks:            ["All fields missing — verify before touring"],
      missingQuestions: [
        "What is the monthly rent?",
        "Are dogs allowed?",
        "Is parking available and what does it cost?",
      ],
      evidence: [],
    };
  });

  return { ...state, rankedUnits };
}
