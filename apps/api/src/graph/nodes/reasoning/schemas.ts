import { z } from "zod";

// Zod schemas for the reasoning-layer prompt outputs (judge / compare / tour /
// missing-info). Permissive on inner shapes (LLM-authored) but structured enough
// to validate + store. Enums self-heal via .catch() so a stray value never fails
// the whole parse.

const severity = z.enum(["blocker", "warning", "info"]).catch("info");

/** Shared judge result — judge_floorplan.md and judge_report.md. */
export const judgeResultSchema = z.object({
  passed: z.boolean(),
  score: z.number(),
  findings: z.array(
    z.object({
      severity,
      field: z.string(),
      issue: z.string(),
      suggestedFix: z.string(),
    })
  ),
});
export type JudgeResultOut = z.infer<typeof judgeResultSchema>;

/** judge_extractions.md — fact-level audit. */
export const judgeExtractionsSchema = z.object({
  validFacts: z.array(z.string()).catch([]),
  downgradedFacts: z.array(z.object({ field: z.string().nullish(), reason: z.string().nullish() })).catch([]),
  unsupportedClaims: z.array(z.object({ field: z.string().nullish(), reason: z.string().nullish() })).catch([]),
  conflictingFacts: z.array(z.object({ field: z.string().nullish(), reason: z.string().nullish() })).catch([]),
  summary: z.string(),
});
export type JudgeExtractionsOut = z.infer<typeof judgeExtractionsSchema>;

// ── Comparison tabs ─────────────────────────────────────────────────────────

const num = z.number().nullish();
const str = z.string().nullish();

/** generate_unit_comparison.md */
export const unitComparisonSchema = z.object({
  unitInsights: z
    .array(
      z.object({
        propertyName: str,
        unitName: str,
        whyItMatchesSelectedPriorities: z.array(z.string()).catch([]),
        concreteEvidence: z.array(z.string()).catch([]),
        caveats: z.array(z.string()).catch([]),
        missingInfo: z.array(z.string()).catch([]),
      })
    )
    .catch([]),
  allUnitsRows: z
    .array(
      z.object({
        propertyId: str,
        propertyName: str,
        unitId: str,
        unitName: str,
        rent: num,
        sqft: num,
        beds: num,
        baths: num,
        availability: str,
        bedroomDimensions: str,
        bathroomType: str,
        closetStorage: str,
        kitchen: str,
        balconyPatio: str,
        livingDining: str,
        wfhFit: str,
        floorPlanConfidence: z.string().nullish(),
        missingUnitSpecificInfo: z.array(z.string()).catch([]),
        insight: str,
      })
    )
    .catch([]),
  groupedByApartment: z
    .array(z.object({ propertyId: str, propertyName: str, units: z.array(z.unknown()).catch([]) }))
    .catch([]),
});
export type UnitComparisonOut = z.infer<typeof unitComparisonSchema>;

/** generate_apartment_comparison.md */
export const apartmentComparisonSchema = z.object({
  propertyInsights: z
    .array(z.object({ propertyName: str, insight: str, evidence: z.array(z.string()).catch([]) }))
    .catch([]),
  propertyComparisonRows: z
    .array(
      z.object({
        propertyId: str,
        propertyName: str,
        petPolicySummary: str,
        parkingSummary: str,
        amenitiesHighlights: z.array(z.string()).catch([]),
        knownExtraFees: z.array(z.string()).catch([]),
        missingCriticalInfo: z.array(z.string()).catch([]),
        evidenceStatus: z.string().nullish(),
        insight: str,
      })
    )
    .catch([]),
});
export type ApartmentComparisonOut = z.infer<typeof apartmentComparisonSchema>;

// ── Missing info questions ──────────────────────────────────────────────────

const question = z.object({
  id: str,
  propertyName: str,
  unitName: str,
  missingField: str,
  questionText: z.string(),
  whyItMatters: str,
  copyText: str,
  priority: z.string().nullish(),
});

/** generate_missing_questions.md */
export const missingQuestionsSchema = z.object({
  critical: z.array(question).catch([]),
  important: z.array(question).catch([]),
  niceToHave: z.array(question).catch([]),
  copyAllText: z.string().nullish(),
  copyByProperty: z.array(z.object({ propertyName: str, copyText: str })).catch([]),
});
export type MissingQuestionsOut = z.infer<typeof missingQuestionsSchema>;

// ── Tour plan ───────────────────────────────────────────────────────────────

const tourGroupItem = z.object({
  propertyId: str,
  propertyName: str,
  suggestedAction: str,
  unitsToAskFor: z.array(z.string()).catch([]),
  reasons: z.array(z.string()).catch([]),
  evidence: z.array(z.string()).catch([]),
  verifyDuringTour: z.array(z.string()).catch([]),
  verifyInVirtualTour: z.array(z.string()).catch([]),
  askBeforeDecidingQuestions: z.array(z.string()).catch([]),
});

/** generate_tour_plan.md */
export const tourPlanSchema = z.object({
  inPersonTour: z.array(tourGroupItem).catch([]),
  virtualTourAcceptable: z.array(tourGroupItem).catch([]),
  askBeforeDeciding: z.array(tourGroupItem).catch([]),
  skip: z.array(tourGroupItem).catch([]),
});
export type TourPlanOut = z.infer<typeof tourPlanSchema>;
