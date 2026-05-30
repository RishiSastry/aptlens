import type { DiscoveredAsset, EvidenceField, PropertyFacts, UnitCandidate } from "@aptlens/shared";
import type { CrawledAsset, PropertyCrawl } from "../../../services/apify.js";

const MISSING = { value: null, status: "missing", confidence: "low" } as const;

/** True when an LLM provider key is available to attempt extraction. */
export function llmConfigured(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** All-missing property facts (used as fallback when extraction can't run). */
export function emptyPropertyFacts(): PropertyFacts {
  return {
    petAllowed: { ...MISSING },
    petRent: { ...MISSING },
    petDeposit: { ...MISSING },
    oneTimePetFee: { ...MISSING },
    petWeightLimit: { ...MISSING },
    breedRestrictions: { ...MISSING },
    parkingFee: { ...MISSING },
    parkingPolicy: { ...MISSING },
    utilitiesIncluded: { ...MISSING },
    amenityFee: { ...MISSING },
    applicationFee: { ...MISSING },
    adminFee: { ...MISSING },
    securityDeposit: { ...MISSING },
  };
}

const missingField = <T>(): EvidenceField<T | null> => ({ value: null, status: "missing", confidence: "low" });

/** A single placeholder unit for a property we couldn't extract from. */
export function placeholderUnit(propertyId: string, propertyName: string): UnitCandidate {
  return {
    unitId: `${propertyId}-unit-1`,
    propertyId,
    propertyName,
    unitName: "Unit TBD",
    rent: missingField<number>(),
    sqft: missingField<number>(),
    bedrooms: missingField<number>(),
    bathrooms: missingField<number>(),
    availableDate: missingField<string>(),
    floorPlanAssets: [],
    viability: "maybe_viable_needs_clarification",
  };
}

const CHARS_PER_PAGE = 4000;
const CHARS_TOTAL = 24000;

/** Concatenate crawled pages into a single source-annotated blob for the LLM. */
export function buildPageContent(crawl: PropertyCrawl): string {
  let total = 0;
  const chunks: string[] = [];
  for (const page of crawl.pages) {
    if (!page.text) continue;
    const body = page.text.slice(0, CHARS_PER_PAGE);
    const chunk = `## ${page.title ?? "Page"} (${page.url})\n${body}`;
    if (total + chunk.length > CHARS_TOTAL) break;
    chunks.push(chunk);
    total += chunk.length;
  }
  return chunks.join("\n\n");
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function toDiscoveredAsset(propertyId: string, asset: CrawledAsset): DiscoveredAsset {
  return {
    propertyId,
    type: asset.type === "floor_plan_pdf" ? "floor_plan_pdf" : "floor_plan_image",
    url: asset.url,
    sourcePageUrl: asset.sourcePageUrl,
    confidence: "medium",
  };
}

/** Decorative graphics that match "floorplan" by name but aren't unit diagrams. */
const NON_PLAN_IMAGE = /icon|logo|sprite|thumb|badge|banner|favicon/i;

/** Property-level assets that plausibly depict a floor plan. */
export function floorPlanCandidates(crawl: PropertyCrawl): CrawledAsset[] {
  return crawl.assets.filter(
    (a) =>
      // Already classified as a plan by the DOM scraper.
      a.type === "floor_plan_image" ||
      a.type === "floor_plan_pdf" ||
      // Or a generic image whose URL hints "floor plan" (and isn't a UI icon).
      (a.type === "image" && /floor|plan|\bfp\b/i.test(a.url) && !NON_PLAN_IMAGE.test(a.url))
  );
}

/**
 * Best-effort mapping of property floor-plan assets to a specific unit:
 *   - single unit → it owns all candidates
 *   - otherwise   → match the unit's floor-plan/unit name slug against the asset's
 *     alt-text label (e.g. "A1 - 1x1 Floor plan") or its URL. The label is the
 *     reliable signal since plan-image URLs are usually opaque CDN hashes.
 */
export function selectAssetsForUnit(
  propertyId: string,
  candidates: CrawledAsset[],
  unitName: string,
  floorPlanName: string | undefined,
  onlyUnit: boolean
): DiscoveredAsset[] {
  if (onlyUnit) return candidates.map((a) => toDiscoveredAsset(propertyId, a));

  const keys = [floorPlanName, unitName].filter(Boolean).map((s) => slug(s!));
  return candidates
    .filter((a) => {
      const haystack = slug(`${a.label ?? ""} ${a.url}`);
      return keys.some((k) => k.length >= 2 && haystack.includes(k));
    })
    .map((a) => toDiscoveredAsset(propertyId, a));
}
