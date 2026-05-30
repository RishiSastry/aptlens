import type { PropertyRecommendation } from "@aptlens/shared";
import type { PipelineState, TourPlan } from "../../state.js";
import { callStructured } from "../../../services/llm.js";
import { llmConfigured } from "../extraction/helpers.js";
import { tourPlanSchema, type TourPlanOut } from "./schemas.js";
import {
  floorPlanAnalysisJson,
  missingInfoJson,
  propertyFactsJson,
  unitFactsJson,
  userPreferencesJson,
} from "./context.js";

type Group = TourPlanOut["inPersonTour"];

function toRecs(group: Group, priority: PropertyRecommendation["tourPriority"]): PropertyRecommendation[] {
  return group.map((g) => ({
    propertyId: g.propertyId ?? g.propertyName ?? "unknown",
    propertyName: g.propertyName ?? "",
    tourPriority: priority,
    unitsToAskFor: g.unitsToAskFor,
    reasons: g.reasons,
    verifyDuringTour: [...g.verifyDuringTour, ...g.verifyInVirtualTour],
    askBeforeTouring: g.askBeforeDecidingQuestions,
  }));
}

/** Map the four LLM tour groups onto the response TourPlan shape. */
function toTourPlan(out: TourPlanOut): TourPlan {
  return {
    tourFirst: [...toRecs(out.inPersonTour, "tour_first"), ...toRecs(out.virtualTourAcceptable, "tour_first")],
    askBeforeTouring: toRecs(out.askBeforeDeciding, "ask_before_touring"),
    skip: toRecs(out.skip, "skip"),
  };
}

/**
 * Generate the Tour Plan tab (generate_tour_plan.md) with LLM reasoning, and
 * refresh the response TourPlan from it. Falls back to the existing rule-based
 * plan on failure.
 */
export async function generateTourPlanLLM(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured()) return state;
  try {
    const out = await callStructured<TourPlanOut>({
      role: "text",
      promptFile: "generate_tour_plan.md",
      vars: {
        userPreferences: userPreferencesJson(state),
        propertyFacts: propertyFactsJson(state),
        unitFacts: unitFactsJson(state),
        floorPlanAnalysis: floorPlanAnalysisJson(state),
        missingInfo: missingInfoJson(state),
      },
      schema: tourPlanSchema,
    });
    console.log(
      `[generateTourPlanLLM] inPerson=${out.inPersonTour.length} virtual=${out.virtualTourAcceptable.length} ask=${out.askBeforeDeciding.length} skip=${out.skip.length}`
    );
    return { ...state, tourPlanTabs: out, tourPlan: toTourPlan(out) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[generateTourPlanLLM] failed: ${reason}`);
    return { ...state, errors: [...state.errors, `generateTourPlanLLM failed: ${reason}`] };
  }
}
