import type { ComparisonViews } from "@aptlens/shared/chartTypes";
import type { PipelineState } from "../state.js";

// TODO (Task 4): populate views from real scored data
export async function buildComparisonViews(state: PipelineState): Promise<PipelineState> {
  const { rankedUnits, request } = state;
  const budget = request.preferences.budgetMaxMonthly;

  console.log(`[buildComparisonViews] Building views for ${rankedUnits.length} units`);

  const comparisonViews: ComparisonViews = {
    constraintFit: rankedUnits.map((u) => ({
      unitId:               u.unitId,
      unitLabel:            `${u.propertyName} ${u.unitName}`,
      cost:                 u.scores.cost,
      petFit:               u.scores.petFit,
      wfhFit:               u.scores.wfhFit,
      parking:              u.scores.parking,
      storage:              u.scores.storage,
      evidenceCompleteness: u.scores.evidenceCompleteness,
      overall:              u.overallScore,
    })),

    costBreakdown: rankedUnits.map((u) => ({
      unitId:             u.unitId,
      unitLabel:          `${u.propertyName} ${u.unitName}`,
      baseRent:           u.costBreakdown.baseRent           ?? 0,
      parkingFee:         u.costBreakdown.parkingFee         ?? 0,
      petRent:            u.costBreakdown.petRent            ?? 0,
      amenityFee:         u.costBreakdown.amenityFee         ?? 0,
      knownMonthlyTotal:  u.costBreakdown.knownMonthlyTotal  ?? 0,
      budgetMaxMonthly:   budget,
      unknownFields:      u.costBreakdown.unknownCostFields,
    })),

    evidenceQuality: rankedUnits.map((u) => ({
      unitId:         u.unitId,
      unitLabel:      `${u.propertyName} ${u.unitName}`,
      confirmed:      u.evidence.filter((e) => e.status === "confirmed").length,
      likely:         u.evidence.filter((e) => e.status === "likely").length,
      unclear:        u.evidence.filter((e) => e.status === "unclear").length,
      missing:        u.evidence.filter((e) => e.status === "missing").length,
      conflicting:    u.evidence.filter((e) => e.status === "conflicting").length,
      blockingMissing: u.missingQuestions.length,
    })),

    petMatrix: rankedUnits.map((u) => ({
      unitId:            u.unitId,
      unitLabel:         `${u.propertyName} ${u.unitName}`,
      petsAllowed:       u.petSignals.petAllowed,
      petRent:           u.petSignals.petRent,
      petDeposit:        u.petSignals.petDeposit,
      weightLimit:       u.petSignals.weightLimit,
      breedRestrictions: u.petSignals.breedRestrictions,
      compatibility:     u.petSignals.petAllowed === "confirmed" ? "good"
                       : u.petSignals.petAllowed === "missing"   ? "unknown"
                       : "needs_confirmation",
      question: u.missingQuestions.find((q) =>
        q.toLowerCase().includes("dog") || q.toLowerCase().includes("pet")
      ),
    })),

    floorPlanMatrix: rankedUnits.map((u) => ({
      unitId:                    u.unitId,
      unitLabel:                 `${u.propertyName} ${u.unitName}`,
      bedroomDimensions:         u.floorPlanSignals.bedroomDimensions,
      livingRoomDimensions:      u.floorPlanSignals.livingRoomDimensions,
      queenBedFit:               u.floorPlanSignals.queenBedFit,
      deskFit:                   u.floorPlanSignals.deskFit,
      wfhFitScore:               u.scores.wfhFit,
      storageScore:              u.scores.storage,
      kitchenScore:              50,
      livingRoomScore:           50,
      bathroomConvenienceScore:  50,
      confidence:                u.floorPlanSignals.floorPlanConfidence,
      tourVerification:          [],
    })),

    propertyTourGroups: state.tourPlan
      ? [
          ...state.tourPlan.tourFirst.map((r) => ({
            propertyId:       r.propertyId,
            propertyName:     r.propertyName,
            tourPriority:     "tour_first" as const,
            unitsToAskFor:    r.unitsToAskFor,
            reasons:          r.reasons,
            blockingQuestions: r.askBeforeTouring,
          })),
          ...state.tourPlan.askBeforeTouring.map((r) => ({
            propertyId:       r.propertyId,
            propertyName:     r.propertyName,
            tourPriority:     "ask_before_touring" as const,
            unitsToAskFor:    r.unitsToAskFor,
            reasons:          r.reasons,
            blockingQuestions: r.askBeforeTouring,
          })),
          ...state.tourPlan.skip.map((r) => ({
            propertyId:       r.propertyId,
            propertyName:     r.propertyName,
            tourPriority:     "skip" as const,
            unitsToAskFor:    [],
            reasons:          r.reasons,
            blockingQuestions: [],
          })),
        ]
      : [],
  };

  return { ...state, comparisonViews };
}
