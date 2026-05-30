import type { FloorPlanAnalysis, UnitCandidate } from "@aptlens/shared";
import type { PipelineState } from "../state.js";
import { analyzeImages } from "../../services/vision.js";
import { floorPlanAnalysisSchema } from "./extraction/schemas.js";

/** Cheap proxy for unit data quality, used to prioritize which units to analyze. */
function knownFieldCount(u: UnitCandidate): number {
  return [u.rent, u.sqft, u.bedrooms, u.bathrooms, u.availableDate].filter(
    (f) => f.value !== null && f.status !== "missing"
  ).length;
}

/**
 * Pick units for the expensive vision pass (plan §selectUnitsForDeepAnalysis):
 *   - only units that actually have floor-plan assets
 *   - ≤5 candidates → all of them
 *   - otherwise → top 2 per property by data quality, capped at 5 overall
 */
export function selectUnitsForDeepAnalysis(units: UnitCandidate[]): UnitCandidate[] {
  const withAssets = units.filter((u) => u.floorPlanAssets.length > 0);
  if (withAssets.length <= 5) return withAssets;

  const byProperty = new Map<string, UnitCandidate[]>();
  for (const u of withAssets) {
    const group = byProperty.get(u.propertyId) ?? [];
    group.push(u);
    byProperty.set(u.propertyId, group);
  }

  const selected: UnitCandidate[] = [];
  for (const group of byProperty.values()) {
    group.sort((a, b) => knownFieldCount(b) - knownFieldCount(a));
    selected.push(...group.slice(0, 2));
  }
  selected.sort((a, b) => knownFieldCount(b) - knownFieldCount(a));
  return selected.slice(0, 5);
}

/** Only raster floor-plan images can be sent to vision; PDFs are skipped (no conversion yet). */
function imageUrls(unit: UnitCandidate): string[] {
  return unit.floorPlanAssets.filter((a) => a.type === "floor_plan_image").map((a) => a.url);
}

/**
 * Analyze floor-plan images for the selected units and attach a structured
 * FloorPlanAnalysis to each. Best-effort: skips entirely without an OpenAI key,
 * and a per-unit failure is recorded but never crashes the pipeline.
 */
export async function analyzeFloorplans(state: PipelineState): Promise<PipelineState> {
  const errors = [...state.errors];

  if (!process.env.OPENAI_API_KEY) {
    console.log("[analyzeFloorplans] No OPENAI_API_KEY — skipping vision analysis");
    return state;
  }

  const userPreferences = JSON.stringify(state.request.preferences);
  const selected = selectUnitsForDeepAnalysis(state.units).filter((u) => imageUrls(u).length > 0);
  console.log(`[analyzeFloorplans] Analyzing floor plans for ${selected.length} units`);

  await Promise.all(
    selected.map(async (unit) => {
      try {
        const urls = imageUrls(unit);
        const analysis = await analyzeImages({
          promptFile: "analyze_floorplan.md",
          imageUrls: urls,
          vars: {
            userPreferences,
            unitContext: JSON.stringify({
              unitId: unit.unitId,
              unitName: unit.unitName,
              floorPlanName: unit.floorPlanName,
              bedrooms: unit.bedrooms.value,
              sqft: unit.sqft.value,
            }),
            floorPlanEvidence: `Floor-plan image(s) attached for analysis:\n${urls.join("\n")}`,
          },
          schema: floorPlanAnalysisSchema,
        });
        // Mutates the shared unit object (referenced by both state.units and property.units).
        unit.floorPlanAnalysis = { unitId: unit.unitId, ...analysis } as FloorPlanAnalysis;
        console.log(`[analyzeFloorplans] ${unit.unitId} → confidence ${analysis.confidence}`);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[analyzeFloorplans] Vision failed for ${unit.unitId}: ${reason}`);
        errors.push(`Floor-plan vision failed for ${unit.unitId}: ${reason}`);
      }
    })
  );

  return { ...state, errors };
}
