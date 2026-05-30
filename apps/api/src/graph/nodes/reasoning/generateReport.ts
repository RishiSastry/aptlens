import type { PipelineState } from "../../state.js";
import { callStructured, callText } from "../../../services/llm.js";
import { llmConfigured } from "../extraction/helpers.js";
import { judgeResultSchema, type JudgeResultOut } from "./schemas.js";
import { buildEvidence, missingInfoJson, userPreferencesJson } from "./context.js";

const MAX_RETRIES = 1;

const fourTabOutputs = (state: PipelineState): string =>
  JSON.stringify({
    tourPlan: state.tourPlanTabs,
    apartmentComparison: state.apartmentComparison,
    unitComparison: state.unitComparison,
    missingQuestions: state.missingQuestions,
  });

/**
 * Assemble the Markdown decision packet (generate_report.md) from the four tab
 * outputs. Markdown, not JSON — uses callText.
 */
export async function generateReport(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured()) return state;
  try {
    const markdown = await callText({
      role: "text",
      promptFile: "generate_report.md",
      vars: {
        userPreferences: userPreferencesJson(state),
        tourPlan: JSON.stringify(state.tourPlanTabs),
        apartmentComparison: JSON.stringify(state.apartmentComparison),
        unitComparison: JSON.stringify(state.unitComparison),
        missingInfo: missingInfoJson(state),
        evidence: buildEvidence(state),
      },
    });
    console.log(`[generateReport] decision packet: ${markdown.length} chars`);
    return { ...state, decisionPacket: markdown };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[generateReport] failed: ${reason}`);
    return { ...state, errors: [...state.errors, `generateReport failed: ${reason}`] };
  }
}

/** LLM-as-judge over the decision packet (judge_report.md). */
export async function judgeReport(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured() || !state.decisionPacket) return state;
  try {
    const result = await callStructured<JudgeResultOut>({
      role: "judge",
      promptFile: "judge_report.md",
      vars: {
        userPreferences: userPreferencesJson(state),
        fourTabOutputs: fourTabOutputs(state),
        decisionPacket: state.decisionPacket,
        evidence: buildEvidence(state),
      },
      schema: judgeResultSchema,
    });
    console.log(`[judgeReport] passed=${result.passed} score=${result.score} findings=${result.findings.length}`);
    return { ...state, judge: { ...state.judge, report: result } };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[judgeReport] failed: ${reason}`);
    return { ...state, errors: [...state.errors, `judgeReport failed: ${reason}`] };
  }
}

export function reportNeedsRepair(state: PipelineState): boolean {
  const j = state.judge.report;
  return !!j && !j.passed && state.retryCounts.report < MAX_RETRIES;
}

/** Repair: regenerate the decision packet once more, bumping the retry counter. */
export async function repairReport(state: PipelineState): Promise<PipelineState> {
  console.log(`[repairReport] regenerating decision packet (attempt ${state.retryCounts.report + 1})`);
  const regenerated = await generateReport(state);
  return { ...regenerated, retryCounts: { ...state.retryCounts, report: state.retryCounts.report + 1 } };
}
