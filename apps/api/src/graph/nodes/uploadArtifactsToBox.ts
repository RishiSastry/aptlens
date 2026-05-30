import type { PipelineState } from "../state.js";
import { boxConfigured, uploadJson, type BoxFile } from "../../services/box.js";

/** Tour-ready checklist derived from the ranked tour plan. */
function buildTourChecklist(state: PipelineState) {
  const tp = state.tourPlan;
  return {
    generatedAt: new Date().toISOString(),
    tourFirst: tp?.tourFirst ?? [],
    askBeforeTouring: tp?.askBeforeTouring ?? [],
    skip: tp?.skip ?? [],
  };
}

/** Leasing questions grouped by property, from tracked missing info. */
function buildLeasingQuestions(state: PipelineState) {
  const byProperty = new Map<string, { propertyName: string; questions: string[] }>();
  for (const item of state.missingInfo) {
    const entry = byProperty.get(item.propertyId) ?? {
      propertyName: item.propertyName,
      questions: [],
    };
    if (!entry.questions.includes(item.question)) entry.questions.push(item.question);
    byProperty.set(item.propertyId, entry);
  }
  return {
    generatedAt: new Date().toISOString(),
    properties: [...byProperty.entries()].map(([propertyId, v]) => ({ propertyId, ...v })),
  };
}

/** The decision packet — the headline artifact summarizing the analysis. */
function buildDecisionPacket(state: PipelineState) {
  return {
    generatedAt: new Date().toISOString(),
    rankedUnits: state.rankedUnits,
    tourPlan: state.tourPlan,
    comparisonViews: state.comparisonViews,
  };
}

/**
 * Upload generated artifacts + raw evidence to the run's Box workspace and
 * record their URLs on `state.artifacts`.
 *
 * Each upload is independent and best-effort: a single failure is recorded in
 * `state.errors` but never blocks the others or throws (plan §Box fallback).
 */
export async function uploadArtifactsToBox(state: PipelineState): Promise<PipelineState> {
  if (!boxConfigured() || !state.box) {
    console.log("[uploadArtifactsToBox] No Box workspace — skipping upload");
    return state;
  }

  const { subfolders } = state.box;
  const errors = [...state.errors];

  async function tryUpload(name: string, data: unknown, folderId: string | undefined) {
    if (!folderId) return undefined;
    try {
      const file = await uploadJson(name, data, folderId);
      console.log(`[uploadArtifactsToBox] Uploaded ${name} → ${file.id}`);
      return file;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[uploadArtifactsToBox] Failed to upload ${name}: ${reason}`);
      errors.push(`Box upload failed for ${name}: ${reason}`);
      return undefined;
    }
  }

  // Raw evidence + extracted facts (kept for traceability; not surfaced as artifact URLs).
  await tryUpload("crawl.json", state.crawlResults, subfolders["raw-evidence"]);
  await tryUpload(
    "extracted-facts.json",
    { properties: state.properties, units: state.units },
    subfolders["properties"]
  );

  // Reports — these become the user-facing artifact links.
  const reports = subfolders["reports"];
  const decisionPacket = await tryUpload("decision-packet.json", buildDecisionPacket(state), reports);
  const missingInfo = await tryUpload("missing-info.json", state.missingInfo, reports);
  const tourChecklist = await tryUpload("tour-checklist.json", buildTourChecklist(state), reports);
  const leasingQuestions = await tryUpload(
    "leasing-questions.json",
    buildLeasingQuestions(state),
    reports
  );

  const withUrl = (file: BoxFile | undefined) => file?.url;

  return {
    ...state,
    errors,
    artifacts: {
      ...state.artifacts,
      comparisonReportBoxUrl: withUrl(decisionPacket) ?? state.artifacts.comparisonReportBoxUrl,
      missingInfoTrackerBoxUrl: withUrl(missingInfo) ?? state.artifacts.missingInfoTrackerBoxUrl,
      tourChecklistBoxUrl: withUrl(tourChecklist) ?? state.artifacts.tourChecklistBoxUrl,
      leasingQuestionsBoxUrl: withUrl(leasingQuestions) ?? state.artifacts.leasingQuestionsBoxUrl,
    },
  };
}
