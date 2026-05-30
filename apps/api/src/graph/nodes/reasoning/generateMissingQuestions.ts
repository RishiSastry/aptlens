import type { MissingInfoItem } from "@aptlens/shared";
import type { PipelineState } from "../../state.js";
import { callStructured } from "../../../services/llm.js";
import { llmConfigured } from "../extraction/helpers.js";
import { missingQuestionsSchema, type MissingQuestionsOut } from "./schemas.js";
import { missingInfoJson, propertyFactsJson, unitFactsJson, userPreferencesJson } from "./context.js";

const PRIORITY: Record<string, MissingInfoItem["priority"]> = {
  critical: "blocking",
  important: "important",
  niceToHave: "nice_to_have",
};

/** Flatten the tabbed questions into MissingInfoItem[] for the API response. */
function toMissingInfo(out: MissingQuestionsOut, state: PipelineState): MissingInfoItem[] {
  const idByName = new Map(state.properties.map((p) => [p.name, p.propertyId]));
  const groups: [keyof typeof PRIORITY, MissingQuestionsOut["critical"]][] = [
    ["critical", out.critical],
    ["important", out.important],
    ["niceToHave", out.niceToHave],
  ];
  return groups.flatMap(([key, items]) =>
    items.map((q) => ({
      propertyId: idByName.get(q.propertyName ?? "") ?? q.propertyName ?? "unknown",
      propertyName: q.propertyName ?? "",
      unitName: q.unitName ?? undefined,
      field: q.missingField ?? "unknown",
      priority: PRIORITY[key],
      question: q.questionText,
      reason: q.whyItMatters ?? "Flagged as missing during extraction",
    }))
  );
}

/**
 * Generate the Missing Info tab (generate_missing_questions.md): prioritized
 * leasing-office questions with copy-paste text. Also refreshes state.missingInfo.
 */
export async function generateMissingQuestions(state: PipelineState): Promise<PipelineState> {
  if (!llmConfigured()) return state;
  try {
    const out = await callStructured<MissingQuestionsOut>({
      role: "text",
      promptFile: "generate_missing_questions.md",
      vars: {
        structuredFacts: `${propertyFactsJson(state)}\n${unitFactsJson(state)}`,
        userPreferences: userPreferencesJson(state),
        missingFacts: missingInfoJson(state),
      },
      schema: missingQuestionsSchema,
    });
    const missingInfo = toMissingInfo(out, state);
    console.log(
      `[generateMissingQuestions] ${out.critical.length} critical, ${out.important.length} important, ${out.niceToHave.length} nice-to-have`
    );
    return { ...state, missingQuestions: out, missingInfo: missingInfo.length ? missingInfo : state.missingInfo };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[generateMissingQuestions] failed: ${reason}`);
    return { ...state, errors: [...state.errors, `generateMissingQuestions failed: ${reason}`] };
  }
}
