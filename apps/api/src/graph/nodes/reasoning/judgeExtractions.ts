import type { PipelineState } from "../../state.js";
import { callStructured } from "../../../services/llm.js";
import { llmConfigured } from "../extraction/helpers.js";
import { judgeExtractionsSchema, type JudgeExtractionsOut } from "./schemas.js";
import { buildEvidence, propertyFactsJson, unitFactsJson } from "./context.js";

const MAX_RETRIES = 1;

/**
 * LLM-as-judge over the extracted property/unit facts (judge_extractions.md).
 * Stores the audit on state.judge.extraction; routing decides whether to repair.
 */
export async function judgeExtractions(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured()) return state;
  try {
    const result = await callStructured<JudgeExtractionsOut>({
      role: "judge",
      promptFile: "judge_extractions.md",
      vars: {
        evidence: buildEvidence(state),
        propertyFacts: propertyFactsJson(state),
        unitFacts: unitFactsJson(state),
      },
      schema: judgeExtractionsSchema,
    });
    console.log(
      `[judgeExtractions] ${result.unsupportedClaims.length} unsupported, ${result.conflictingFacts.length} conflicting, ${result.downgradedFacts.length} downgraded`
    );
    return { ...state, judge: { ...state.judge, extraction: result } };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[judgeExtractions] failed: ${reason}`);
    return { ...state, errors: [...state.errors, `judgeExtractions failed: ${reason}`] };
  }
}

/** True when the extraction audit flags problems worth a repair pass (within retry cap). */
export function extractionNeedsRepair(state: PipelineState): boolean {
  const j = state.judge.extraction;
  if (!j) return false;
  const flagged = j.unsupportedClaims.length + j.conflictingFacts.length + j.downgradedFacts.length;
  return flagged > 0 && state.retryCounts.extraction < MAX_RETRIES;
}

/** Field names the judge flagged as unsupported/downgraded/conflicting. */
function flaggedFields(state: PipelineState): Set<string> {
  const j = state.judge.extraction;
  const names = new Set<string>();
  for (const list of [j?.unsupportedClaims, j?.downgradedFacts, j?.conflictingFacts]) {
    for (const f of list ?? []) if (f.field) names.add(f.field.toLowerCase());
  }
  return names;
}

/**
 * Deterministic repair: downgrade confidence + status on the property/unit
 * EvidenceFields the judge flagged, so unsupported claims stop reading as solid.
 */
export async function repairExtractions(state: PipelineState): Promise<PipelineState> {
  const flagged = flaggedFields(state);
  let touched = 0;

  const downgrade = (obj: Record<string, unknown> | undefined) => {
    if (!obj) return;
    for (const [key, val] of Object.entries(obj)) {
      if (!flagged.has(key.toLowerCase())) continue;
      const f = val as { status?: string; confidence?: string };
      if (f && typeof f === "object" && "status" in f) {
        f.status = "unclear";
        f.confidence = "low";
        touched++;
      }
    }
  };

  for (const p of state.properties) downgrade(p.propertyFacts as Record<string, unknown> | undefined);
  for (const u of state.units) downgrade(u as unknown as Record<string, unknown>);

  console.log(`[repairExtractions] downgraded ${touched} flagged fields (attempt ${state.retryCounts.extraction + 1})`);
  return { ...state, retryCounts: { ...state.retryCounts, extraction: state.retryCounts.extraction + 1 } };
}
