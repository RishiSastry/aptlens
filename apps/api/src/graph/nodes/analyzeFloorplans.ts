import type { FloorPlanAnalysis, UnitCandidate } from "@aptlens/shared";
import type { PipelineState } from "../state.js";
import { analyzeFloorPlanAssets, type VisionAsset } from "../../services/vision.js";
import { floorPlanAnalysisSchema } from "./extraction/schemas.js";

/** Cheap proxy for unit data quality, used to prioritize which units to analyze. */
function knownFieldCount(u: UnitCandidate): number {
  return [u.rent, u.sqft, u.bedrooms, u.bathrooms, u.availableDate].filter(
    (f) => f && f.value !== null && f.status !== "missing"
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

/** Floor-plan assets (images + PDFs) for a unit, as vision inputs. */
function planAssets(unit: UnitCandidate): VisionAsset[] {
  return unit.floorPlanAssets
    .filter((a) => a.type === "floor_plan_image" || a.type === "floor_plan_pdf")
    .map((a) => ({ url: a.url, type: a.type }));
}

/**
 * Vision models sometimes return usability scores on a 0–10 scale instead of
 * 0–100. If every score is ≤10, rescale ×10 so downstream thresholds (which
 * assume 0–100) read correctly.
 */
function normalizeScores(scores: Record<string, number | null | undefined>): void {
  const vals = Object.values(scores).filter((v): v is number => typeof v === "number");
  if (vals.length > 0 && Math.max(...vals) <= 10) {
    for (const k of Object.keys(scores)) {
      if (typeof scores[k] === "number") scores[k] = Math.min(100, (scores[k] as number) * 10);
    }
  }
}

/**
 * Analyze floor-plan assets (images → GPT-4o, PDFs → Claude) for the selected
 * units and attach a structured FloorPlanAnalysis to each. Best-effort: skips
 * entirely without any vision-capable key, and a per-unit failure is recorded
 * but never crashes the pipeline.
 */
export async function analyzeFloorplans(state: PipelineState): Promise<PipelineState> {
  const errors = [...state.errors];

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.log("[analyzeFloorplans] No OPENAI/ANTHROPIC key — skipping vision analysis");
    return state;
  }

  const userPreferences = JSON.stringify(state.request.preferences);
  const selected = selectUnitsForDeepAnalysis(state.units).filter((u) => planAssets(u).length > 0);
  console.log(`[analyzeFloorplans] Analyzing floor plans for ${selected.length} units`);

  await Promise.all(
    selected.map(async (unit) => {
      try {
        const assets = planAssets(unit);
        const analysis = await analyzeFloorPlanAssets({
          promptFile: "analyze_floorplan.md",
          assets,
          vars: {
            userPreferences,
            unitContext: JSON.stringify({
              unitId: unit.unitId,
              unitName: unit.unitName,
              floorPlanName: unit.floorPlanName,
              bedrooms: unit.bedrooms?.value ?? null,
              sqft: unit.sqft?.value ?? null,
            }),
            floorPlanEvidence: `Floor-plan asset(s) attached for analysis:\n${assets
              .map((a) => `${a.type}: ${a.url}`)
              .join("\n")}`,
          },
          schema: floorPlanAnalysisSchema,
        });
        normalizeScores(analysis.usabilityScores);
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
