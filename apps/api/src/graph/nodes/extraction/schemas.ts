import { z } from "zod";

// Zod mirrors of the shared extraction/vision types, used with
// `.withStructuredOutput(...)`. Kept api-internal (the shared package exports
// the TS types; these are the runtime validators the LLM output is checked against).

// Models sometimes return an out-of-enum value (e.g. confidence "missing",
// conflating it with status). `.catch()` self-heals those to a safe default
// instead of failing the entire structured-output parse.
const status = z.enum(["confirmed", "likely", "unclear", "missing", "conflicting"]).catch("missing");
const confidence = z.enum(["high", "medium", "low"]).catch("low");

/** EvidenceField<value> — value type varies, so accept the JSON-primitive union. */
function evidenceField<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value: value.nullable(),
    status,
    confidence,
    sourceUrl: z.string().nullish(),
    evidenceSnippet: z.string().nullish(),
  });
}

const numberField = evidenceField(z.number());
const stringField = evidenceField(z.string());
const boolField = evidenceField(z.boolean());
const stringOrNumberField = evidenceField(z.union([z.string(), z.number()]));

// ── Property facts ──────────────────────────────────────────────────────────

const amenitiesSchema = z
  .object({
    gym: boolField.nullish(),
    pool: boolField.nullish(),
    rooftop: boolField.nullish(),
    coworking: boolField.nullish(),
    lounge: boolField.nullish(),
    packageRoom: boolField.nullish(),
    dogWash: boolField.nullish(),
    dogPark: boolField.nullish(),
    bikeStorage: boolField.nullish(),
    evCharging: boolField.nullish(),
  })
  .nullish();

export const propertyFactsSchema = z.object({
  petAllowed: boolField,
  petRent: numberField,
  petDeposit: numberField,
  oneTimePetFee: numberField,
  petWeightLimit: stringOrNumberField,
  breedRestrictions: stringField,
  parkingFee: numberField,
  parkingPolicy: stringField,
  utilitiesIncluded: stringField,
  amenityFee: numberField,
  applicationFee: numberField,
  adminFee: numberField,
  securityDeposit: numberField,

  // Richer optional signals (see shared PropertyFacts).
  dogsAllowed: boolField.nullish(),
  catsAllowed: boolField.nullish(),
  maxPets: numberField.nullish(),
  petScreening: boolField.nullish(),
  parkingType: stringField.nullish(),
  evCharging: boolField.nullish(),
  amenities: amenitiesSchema,
  missingCriticalFacts: z.array(z.string()).nullish(),
  conflictingFacts: z.array(z.string()).nullish(),
  notes: z.array(z.string()).nullish(),
});
export type PropertyFactsExtraction = z.infer<typeof propertyFactsSchema>;

// ── Unit candidates ───────────────────────────────────────────────────────

const unitLayoutSignalsSchema = z
  .object({
    bedroom: stringField.nullish(),
    bathroom: stringField.nullish(),
    kitchen: stringField.nullish(),
    livingDining: stringField.nullish(),
    balconyOutdoor: stringField.nullish(),
    closetStorage: stringField.nullish(),
    wfh: stringField.nullish(),
  })
  .nullish();

export const unitExtractionSchema = z.object({
  units: z.array(
    z.object({
      unitName: z.string(),
      floorPlanName: z.string().nullish(),
      rent: numberField,
      sqft: numberField,
      bedrooms: numberField,
      bathrooms: numberField,
      availableDate: stringField,

      // Richer optional signals (see shared UnitCandidate).
      availabilityCount: numberField.nullish(),
      leaseTerm: stringField.nullish(),
      layoutSignals: unitLayoutSignalsSchema,
      missingFacts: z.array(z.string()).nullish(),
      notes: z.array(z.string()).nullish(),
    })
  ),
});
export type UnitExtraction = z.infer<typeof unitExtractionSchema>;

// ── Floor-plan vision analysis ──────────────────────────────────────────────

const roomSignal = z.object({
  type: z.enum([
    "bedroom",
    "bathroom",
    "living_room",
    "kitchen",
    "closet",
    "walk_in_closet",
    "dining",
    "balcony",
    "laundry",
    "entry",
  ]),
  labelFromPlan: z.string().nullish(),
  dimensionsText: z.string().nullish(),
  widthFt: z.number().nullish(),
  lengthFt: z.number().nullish(),
  areaSqft: z.number().nullish(),
  features: z.array(z.string()),
  limitations: z.array(z.string()),
  confidence,
  evidenceDescription: z.string(),
});

/** What the vision model returns; the node adds unitId before storing. */
export const floorPlanAnalysisSchema = z.object({
  floorPlanName: z.string().nullish(),
  rooms: z.object({
    bedrooms: z.array(roomSignal),
    bathrooms: z.array(roomSignal),
    livingRooms: z.array(roomSignal),
    kitchens: z.array(roomSignal),
    closets: z.array(roomSignal),
    walkInClosets: z.array(roomSignal),
    diningAreas: z.array(roomSignal),
    balconies: z.array(roomSignal),
    laundryAreas: z.array(roomSignal),
  }),
  layoutSignals: z.object({
    hasWalkInCloset: boolField,
    hasInUnitLaundry: boolField,
    hasKitchenIsland: boolField,
    hasBalconyOrPatio: boolField,
    bathroomAccess: evidenceField(z.enum(["hallway", "bedroom_ensuite", "unclear"])),
    openKitchenLiving: boolField,
  }),
  usabilityScores: z.object({
    bedroomFitScore: z.number(),
    wfhFitScore: z.number(),
    closetStorageScore: z.number(),
    kitchenUsabilityScore: z.number(),
    livingRoomUsabilityScore: z.number(),
    bathroomConvenienceScore: z.number(),
    livingDiningScore: z.number().nullish(),
  }),
  confidence,
  notes: z.array(z.string()),

  // Narrative outputs (see shared FloorPlanAnalysis).
  insights: z.array(z.string()).nullish(),
  caveats: z.array(z.string()).nullish(),
  tourVerification: z.array(z.string()).nullish(),
});
export type FloorPlanAnalysisExtraction = z.infer<typeof floorPlanAnalysisSchema>;
