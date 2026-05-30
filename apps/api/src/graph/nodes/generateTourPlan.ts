import type { MissingInfoItem, PropertyRecommendation } from "@aptlens/shared";
import type { PipelineState, TourPlan } from "../state.js";

// TODO (Task 7): enhance with LLM-generated reasons and questions using
//   generate_tour_plan.md and generate_missing_questions.md
export async function generateTourPlan(state: PipelineState): Promise<PipelineState> {
  const { rankedUnits, properties } = state;

  console.log(`[generateTourPlan] Grouping ${rankedUnits.length} units into tour plan`);

  // Group ranked units by property
  const byProperty = new Map<string, typeof rankedUnits>();
  for (const unit of rankedUnits) {
    const group = byProperty.get(unit.propertyId) ?? [];
    group.push(unit);
    byProperty.set(unit.propertyId, group);
  }

  const tourFirst: PropertyRecommendation[] = [];
  const askBeforeTouring: PropertyRecommendation[] = [];
  const skip: PropertyRecommendation[] = [];

  for (const [propertyId, propUnits] of byProperty) {
    const prop = properties.find((p) => p.propertyId === propertyId);
    const propertyName = prop?.name ?? propertyId;

    // Best unit for this property
    const best = propUnits[0];
    const priority = best?.tourPriority ?? "ask_before_touring";

    const rec: PropertyRecommendation = {
      propertyId,
      propertyName,
      tourPriority: priority === "backup" ? "tour_first" : priority,
      unitsToAskFor: propUnits.map((u) => u.unitName),
      reasons:         best?.topReasons ?? [],
      verifyDuringTour: [],
      askBeforeTouring: best?.missingQuestions ?? [],
    };

    if (priority === "tour_first" || priority === "backup") {
      tourFirst.push(rec);
    } else if (priority === "skip") {
      skip.push(rec);
    } else {
      askBeforeTouring.push(rec);
    }
  }

  const tourPlan: TourPlan = { tourFirst, askBeforeTouring, skip };

  // Build missing info items from each unit's missing questions
  const missingInfo: MissingInfoItem[] = rankedUnits.flatMap((unit) =>
    unit.missingQuestions.map((question) => ({
      propertyId:   unit.propertyId,
      unitId:       unit.unitId,
      propertyName: unit.propertyName,
      unitName:     unit.unitName,
      field:        "unknown",
      priority:     "important" as const,
      question,
      reason:       "Field not found during extraction",
    }))
  );

  return { ...state, tourPlan, missingInfo };
}
