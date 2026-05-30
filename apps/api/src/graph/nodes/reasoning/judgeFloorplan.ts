import type { PipelineState } from "../../state.js";
import { callStructured } from "../../../services/llm.js";
import { llmConfigured } from "../extraction/helpers.js";
import { judgeResultSchema, type JudgeResultOut } from "./schemas.js";
import { buildEvidence, floorPlanAnalysisJson } from "./context.js";

const MAX_RETRIES = 1;

/**
 * LLM-as-judge over floor-plan vision output (judge_floorplan.md): flags
 * hallucinated dimensions, overconfident fit claims, marketing photos, etc.
 */
export async function judgeFloorplanAnalysis(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured()) return state;
  const analyzed = state.units.filter((u) => u.floorPlanAnalysis);
  if (analyzed.length === 0) return state;

  try {
    const result = await callStructured<JudgeResultOut>({
      role: "judge",
      promptFile: "judge_floorplan.md",
      vars: { floorPlanEvidence: buildEvidence(state), floorPlanAnalysis: floorPlanAnalysisJson(state) },
      schema: judgeResultSchema,
    });
    console.log(
      `[judgeFloorplanAnalysis] passed=${result.passed} score=${result.score} findings=${result.findings.length}`
    );
    return { ...state, judge: { ...state.judge, floorplan: result } };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[judgeFloorplanAnalysis] failed: ${reason}`);
    return { ...state, errors: [...state.errors, `judgeFloorplanAnalysis failed: ${reason}`] };
  }
}

export function floorplanNeedsRepair(state: PipelineState): boolean {
  const j = state.judge.floorplan;
  return !!j && !j.passed && state.retryCounts.floorplan < MAX_RETRIES;
}

/**
 * Deterministic repair: downgrade vision confidence and dampen high usability
 * scores on analyzed units so unsupported claims don't drive the ranking.
 */
export async function repairFloorplan(state: PipelineState): Promise<PipelineState> {
  let touched = 0;
  for (const u of state.units) {
    const fp = u.floorPlanAnalysis;
    if (!fp) continue;
    fp.confidence = "low";
    for (const k of Object.keys(fp.usabilityScores) as (keyof typeof fp.usabilityScores)[]) {
      const v = fp.usabilityScores[k];
      if (typeof v === "number" && v > 50) fp.usabilityScores[k] = 50; // cap overconfident scores
    }
    touched++;
  }
  console.log(`[repairFloorplan] downgraded ${touched} analyses (attempt ${state.retryCounts.floorplan + 1})`);
  return { ...state, retryCounts: { ...state.retryCounts, floorplan: state.retryCounts.floorplan + 1 } };
}
