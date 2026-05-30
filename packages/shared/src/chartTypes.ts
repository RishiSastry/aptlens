export type ComparisonViews = {
  constraintFit: ConstraintFitDatum[];
  costBreakdown: CostBreakdownDatum[];
  evidenceQuality: EvidenceQualityDatum[];
  petMatrix: PetMatrixRow[];
  floorPlanMatrix: FloorPlanMatrixRow[];
  propertyTourGroups: PropertyTourGroup[];
};

export type ConstraintFitDatum = {
  unitId: string;
  unitLabel: string;
  cost: number;
  petFit: number;
  wfhFit: number;
  parking: number;
  storage: number;
  evidenceCompleteness: number;
  overall: number;
};

export type CostBreakdownDatum = {
  unitId: string;
  unitLabel: string;
  baseRent: number;
  parkingFee: number;
  petRent: number;
  amenityFee: number;
  knownMonthlyTotal: number;
  budgetMaxMonthly?: number;
  unknownFields: string[];
};

export type EvidenceQualityDatum = {
  unitId: string;
  unitLabel: string;
  confirmed: number;
  likely: number;
  unclear: number;
  missing: number;
  conflicting: number;
  blockingMissing: number;
};

export type PetMatrixRow = {
  unitId: string;
  unitLabel: string;
  petsAllowed: "confirmed" | "likely" | "unclear" | "missing" | "conflicting";
  petRent?: number;
  petDeposit?: number;
  oneTimePetFee?: number;
  weightLimit?: string;
  breedRestrictions: "confirmed" | "likely" | "unclear" | "missing" | "conflicting";
  compatibility: "good" | "needs_confirmation" | "bad" | "unknown";
  question?: string;
};

export type FloorPlanMatrixRow = {
  unitId: string;
  unitLabel: string;
  bedroomDimensions?: string;
  livingRoomDimensions?: string;
  queenBedFit: "confirmed" | "likely" | "unclear" | "missing" | "conflicting";
  deskFit: "confirmed" | "likely" | "unclear" | "missing" | "conflicting";
  wfhFitScore: number;
  storageScore: number;
  kitchenScore: number;
  livingRoomScore: number;
  bathroomConvenienceScore: number;
  confidence: "high" | "medium" | "low";
  tourVerification: string[];
};

export type PropertyTourGroup = {
  propertyId: string;
  propertyName: string;
  tourPriority: "tour_first" | "ask_before_touring" | "skip";
  unitsToAskFor: string[];
  bestValueUnitId?: string;
  bestWfhUnitId?: string;
  reasons: string[];
  blockingQuestions: string[];
};
