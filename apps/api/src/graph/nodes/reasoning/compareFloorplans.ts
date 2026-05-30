import type { PipelineState } from "../../state.js";
import { callStructured } from "../../../services/llm.js";
import { llmConfigured } from "../extraction/helpers.js";
import {
  apartmentComparisonSchema,
  unitComparisonSchema,
  type ApartmentComparisonOut,
  type UnitComparisonOut,
} from "./schemas.js";
import {
  buildEvidence,
  floorPlanAnalysisJson,
  missingInfoJson,
  propertyFactsJson,
  unitFactsJson,
  userPreferencesJson,
} from "./context.js";

/**
 * Generate the Unit Comparison and Apartment Comparison tabs (the two
 * generate_*_comparison.md prompts) in parallel. Stored for the report + UI.
 */
export async function compareFloorplans(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured()) return state;
  const errors = [...state.errors];

  const [unit, apartment] = await Promise.all([
    callStructured<UnitComparisonOut>({
      role: "text",
      promptFile: "generate_unit_comparison.md",
      vars: {
        userPreferences: userPreferencesJson(state),
        unitFacts: unitFactsJson(state),
        floorPlanAnalysis: floorPlanAnalysisJson(state),
        missingInfo: missingInfoJson(state),
        evidence: buildEvidence(state),
      },
      schema: unitComparisonSchema,
    }).catch((err) => {
      errors.push(`unit comparison failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }),
    callStructured<ApartmentComparisonOut>({
      role: "text",
      promptFile: "generate_apartment_comparison.md",
      vars: {
        userPreferences: userPreferencesJson(state),
        propertyFacts: propertyFactsJson(state),
        missingInfo: missingInfoJson(state),
        evidence: buildEvidence(state),
      },
      schema: apartmentComparisonSchema,
    }).catch((err) => {
      errors.push(`apartment comparison failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }),
  ]);

  console.log(
    `[compareFloorplans] unit rows: ${unit?.allUnitsRows.length ?? 0}, property rows: ${apartment?.propertyComparisonRows.length ?? 0}`
  );
  return { ...state, unitComparison: unit, apartmentComparison: apartment, errors };
}
