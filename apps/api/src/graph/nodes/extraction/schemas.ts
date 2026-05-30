import { z } from "zod";

// Zod mirrors of the shared extraction/vision types, used with
// `.withStructuredOutput(...)`. Kept api-internal (the shared package exports
// the TS types; these are the runtime validators the LLM output is checked against).

const status = z.enum(["confirmed", "likely", "unclear", "missing", "conflicting"]);
const confidence = z.enum(["high", "medium", "low"]);

/** EvidenceField<value> — value type varies, so accept the JSON-primitive union. */
function evidenceField<T extends z.ZodTypeAny>(value: T) {
  return z.object({
    value: value.nullable(),
    status,
    confidence,
    sourceUrl: z.string().optional(),
    evidenceSnippet: z.string().optional(),
  });
}

const numberField = evidenceField(z.number());
const stringField = evidenceField(z.string());
const boolField = evidenceField(z.boolean());
const stringOrNumberField = evidenceField(z.union([z.string(), z.number()]));

// ── Property facts ──────────────────────────────────────────────────────────

const amenitiesSchema = z
  .object({
    gym: boolField.optional(),
    pool: boolField.optional(),
    rooftop: boolField.optional(),
    coworking: boolField.optional(),
    lounge: boolField.optional(),
    packageRoom: boolField.optional(),
    dogWash: boolField.optional(),
    dogPark: boolField.optional(),
    bikeStorage: boolField.optional(),
    evCharging: boolField.optional(),
  })
  .optional();

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
  dogsAllowed: boolField.optional(),
  catsAllowed: boolField.optional(),
  maxPets: numberField.optional(),
  petScreening: boolField.optional(),
  parkingType: stringField.optional(),
  evCharging: boolField.optional(),
  amenities: amenitiesSchema,
  missingCriticalFacts: z.array(z.string()).optional(),
  conflictingFacts: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
});
export type PropertyFactsExtraction = z.infer<typeof propertyFactsSchema>;

// ── Unit candidates ───────────────────────────────────────────────────────

const unitLayoutSignalsSchema = z
  .object({
    bedroom: stringField.optional(),
    bathroom: stringField.optional(),
    kitchen: stringField.optional(),
    livingDining: stringField.optional(),
    balconyOutdoor: stringField.optional(),
    closetStorage: stringField.optional(),
    wfh: stringField.optional(),
  })
  .optional();

export const unitExtractionSchema = z.object({
  units: z.array(
    z.object({
      unitName: z.string(),
      floorPlanName: z.string().optional(),
      rent: numberField,
      sqft: numberField,
      bedrooms: numberField,
      bathrooms: numberField,
      availableDate: stringField,

      // Richer optional signals (see shared UnitCandidate).
      availabilityCount: numberField.optional(),
      leaseTerm: stringField.optional(),
      layoutSignals: unitLayoutSignalsSchema,
      missingFacts: z.array(z.string()).optional(),
      notes: z.array(z.string()).optional(),
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
  labelFromPlan: z.string().optional(),
  dimensionsText: z.string().optional(),
  widthFt: z.number().optional(),
  lengthFt: z.number().optional(),
  areaSqft: z.number().optional(),
  features: z.array(z.string()),
  limitations: z.array(z.string()),
  confidence,
  evidenceDescription: z.string(),
});

/** What the vision model returns; the node adds unitId before storing. */
export const floorPlanAnalysisSchema = z.object({
  floorPlanName: z.string().optional(),
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
    livingDiningScore: z.number().optional(),
  }),
  confidence,
  notes: z.array(z.string()),

  // Narrative outputs (see shared FloorPlanAnalysis).
  insights: z.array(z.string()).optional(),
  caveats: z.array(z.string()).optional(),
  tourVerification: z.array(z.string()).optional(),
});
export type FloorPlanAnalysisExtraction = z.infer<typeof floorPlanAnalysisSchema>;
