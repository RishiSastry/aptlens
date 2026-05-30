import type { PipelineState } from "../../state.js";
import type { PropertyCrawl } from "../../../services/apify.js";

// Helpers that assemble the {{variables}} the reasoning prompts expect from
// pipeline state. Kept compact + length-capped to control token usage.

const EVIDENCE_CAP = 18000;

/** Concatenated, source-annotated crawl text across all properties (capped). */
export function buildEvidence(state: PipelineState): string {
  let total = 0;
  const chunks: string[] = [];
  for (const [propertyId, raw] of Object.entries(state.crawlResults)) {
    const crawl = raw as PropertyCrawl | null;
    if (!crawl?.pages) continue;
    for (const page of crawl.pages) {
      if (!page.text) continue;
      const chunk = `## [${propertyId}] ${page.title ?? "Page"} (${page.url})\n${page.text.slice(0, 3000)}`;
      if (total + chunk.length > EVIDENCE_CAP) return chunks.join("\n\n");
      chunks.push(chunk);
      total += chunk.length;
    }
  }
  return chunks.join("\n\n");
}

export const userPreferencesJson = (state: PipelineState): string =>
  JSON.stringify(state.request.preferences);

/** Property-level facts keyed by property, for {{propertyFacts}}. */
export function propertyFactsJson(state: PipelineState): string {
  return JSON.stringify(
    state.properties.map((p) => ({ propertyId: p.propertyId, name: p.name, facts: p.propertyFacts }))
  );
}

/** Unit-level facts (minus heavy nested analysis), for {{unitFacts}}. */
export function unitFactsJson(state: PipelineState): string {
  return JSON.stringify(
    state.units.map((u) => ({
      unitId: u.unitId,
      propertyId: u.propertyId,
      propertyName: u.propertyName,
      unitName: u.unitName,
      floorPlanName: u.floorPlanName,
      rent: u.rent,
      sqft: u.sqft,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      availableDate: u.availableDate,
      viability: u.viability,
      layoutSignals: u.layoutSignals,
    }))
  );
}

/** Floor-plan vision analyses keyed by unit, for {{floorPlanAnalysis}}. */
export function floorPlanAnalysisJson(state: PipelineState): string {
  return JSON.stringify(
    state.units
      .filter((u) => u.floorPlanAnalysis)
      .map((u) => ({ unitId: u.unitId, unitName: u.unitName, analysis: u.floorPlanAnalysis }))
  );
}

export const missingInfoJson = (state: PipelineState): string => JSON.stringify(state.missingInfo);
