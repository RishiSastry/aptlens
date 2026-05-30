import type { PropertyCandidate, PropertyFacts, UnitCandidate } from "@aptlens/shared";
import type { PipelineState } from "../state.js";
import type { PropertyCrawl } from "../../services/apify.js";
import { callStructured } from "../../services/llm.js";
import { propertyIdFromUrl, propertyNameFromUrl } from "./crawlUrls.js";
import { propertyFactsSchema, unitExtractionSchema } from "./extraction/schemas.js";
import {
  buildPageContent,
  emptyPropertyFacts,
  floorPlanCandidates,
  llmConfigured,
  placeholderUnit,
  selectAssetsForUnit,
} from "./extraction/helpers.js";

/**
 * Turn raw crawl results into typed properties + units.
 *
 * When a property has crawl pages and an LLM key is configured, facts and units
 * are extracted via the LLM with strict evidence discipline. Otherwise (cache
 * miss, no key, empty crawl) we fall back to an all-missing placeholder so the
 * rest of the pipeline still runs. Floor-plan assets are attached here; the
 * analyzeFloorplans node consumes them next.
 */
export async function extractFacts(state: PipelineState): Promise<PipelineState> {
  const { urls } = state.request;
  const llmReady = llmConfigured();
  const errors = [...state.errors];

  console.log(
    `[extractFacts] Extracting ${urls.length} properties (${llmReady ? "LLM" : "placeholder — no LLM key"})`
  );

  // Rachel's prompts take user preferences as a {{userPreferences}} variable.
  const userPreferences = JSON.stringify(state.request.preferences);

  const properties: PropertyCandidate[] = [];
  const allUnits: UnitCandidate[] = [];

  for (const url of urls) {
    const propertyId = propertyIdFromUrl(url);
    const name = propertyNameFromUrl(url);
    const crawl = state.crawlResults[propertyId] as PropertyCrawl | null | undefined;
    const evidence = crawl ? buildPageContent(crawl) : "";

    let facts: PropertyFacts = emptyPropertyFacts();
    let units: UnitCandidate[] = [];

    if (llmReady && crawl && evidence.length > 0) {
      facts = await extractPropertyFacts(userPreferences, evidence, errors, propertyId);
      units = await extractUnits(propertyId, name, userPreferences, facts, evidence, crawl, errors);
    }

    // Fall back to a single placeholder unit if extraction produced none.
    if (units.length === 0) units = [placeholderUnit(propertyId, name)];

    properties.push({ propertyId, name, url, units, propertyFacts: facts });
    allUnits.push(...units);
  }

  return { ...state, properties, units: allUnits, errors };
}

async function extractPropertyFacts(
  userPreferences: string,
  evidence: string,
  errors: string[],
  propertyId: string
): Promise<PropertyFacts> {
  try {
    const result = await callStructured({
      role: "text",
      promptFile: "extract_property_facts.md",
      vars: { userPreferences, evidence },
      schema: propertyFactsSchema,
    });
    return result as PropertyFacts;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[extractFacts] Property-fact extraction failed for ${propertyId}: ${reason}`);
    errors.push(`Property-fact extraction failed for ${propertyId}: ${reason}`);
    return emptyPropertyFacts();
  }
}

async function extractUnits(
  propertyId: string,
  propertyName: string,
  userPreferences: string,
  facts: PropertyFacts,
  evidence: string,
  crawl: PropertyCrawl,
  errors: string[]
): Promise<UnitCandidate[]> {
  let extracted;
  try {
    extracted = await callStructured({
      role: "text",
      promptFile: "extract_unit_facts.md",
      vars: { userPreferences, propertyFacts: JSON.stringify(facts), evidence },
      schema: unitExtractionSchema,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[extractFacts] Unit extraction failed for ${propertyId}: ${reason}`);
    errors.push(`Unit extraction failed for ${propertyId}: ${reason}`);
    return [];
  }

  const candidates = floorPlanCandidates(crawl);
  const onlyUnit = extracted.units.length === 1;

  // The LLM schema mirrors UnitCandidate but with `null` where the domain type
  // uses optional `undefined` — coerce floorPlanName and cast the boundary.
  return extracted.units.map((u, i) => {
    const floorPlanName = u.floorPlanName ?? undefined;
    return {
      unitId: `${propertyId}-unit-${i + 1}`,
      propertyId,
      propertyName,
      unitName: u.unitName,
      floorPlanName,
      rent: u.rent,
      sqft: u.sqft,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      availableDate: u.availableDate,
      availabilityCount: u.availabilityCount,
      leaseTerm: u.leaseTerm,
      layoutSignals: u.layoutSignals,
      missingFacts: u.missingFacts,
      extractionNotes: u.notes,
      floorPlanAssets: selectAssetsForUnit(propertyId, candidates, u.unitName, floorPlanName, onlyUnit),
    };
  }) as unknown as UnitCandidate[];
}
