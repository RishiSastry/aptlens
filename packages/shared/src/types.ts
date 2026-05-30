export type EvidenceStatus =
  | "confirmed"
  | "likely"
  | "unclear"
  | "missing"
  | "conflicting";

export type EvidenceField<T = string | number | boolean | null> = {
  value: T;
  status: EvidenceStatus;
  confidence: "high" | "medium" | "low";
  sourceUrl?: string;
  sourceFileId?: string;
  evidenceSnippet?: string;
};

export type UserPreferences = {
  budgetMaxMonthly?: number;
  moveInBy?: string;
  bedrooms?: string[];
  bathrooms?: string[];
  apartmentTypes?: Array<"studio" | "1b" | "2b" | "3b" | "condo" | "townhouse">;
  lifestylePreferences?: {
    worksFromHome: boolean;
    hostGuestsOften: boolean;
  };
  spacePreferences?: {
    largerBedroom: boolean;
    largerBathroom: boolean;
    largerKitchen: boolean;
    largerLivingRoom: boolean;
    moreStorage: boolean;
    betterWfhLayout: boolean;
    outdoorSpace: boolean;
    preferredOrientation?: string;
  };
  amenityPreferences?: {
    grill: boolean;
    pool: boolean;
    gym: boolean;
    coworking: boolean;
    packageRoom: boolean;
    dogWash: boolean;
    evCharging: boolean;
  };
  pet: {
    hasPet: boolean;
    type?: "dog" | "cat";
    count?: number;
    breed?: string;
    weightLb?: number;
  };
  parking: "required" | "nice_to_have" | "not_needed";
  parkingPreference?: "covered" | "outdoor" | "either";
  worksFromHome: boolean;
  priorities: {
    cost: number;
    petFit: number;
    wfhFit: number;
    parking: number;
    storage: number;
    evidenceCompleteness: number;
  };
};

export type AnalyzeRequest = {
  urls: string[];
  preferences: UserPreferences;
};

/** Building-level amenity signals (optional — populated by richer extraction). */
export type PropertyAmenities = {
  gym?: EvidenceField<boolean | null>;
  pool?: EvidenceField<boolean | null>;
  rooftop?: EvidenceField<boolean | null>;
  coworking?: EvidenceField<boolean | null>;
  lounge?: EvidenceField<boolean | null>;
  packageRoom?: EvidenceField<boolean | null>;
  dogWash?: EvidenceField<boolean | null>;
  dogPark?: EvidenceField<boolean | null>;
  bikeStorage?: EvidenceField<boolean | null>;
  evCharging?: EvidenceField<boolean | null>;
};

export type PropertyFacts = {
  petAllowed: EvidenceField<boolean | null>;
  petRent: EvidenceField<number | null>;
  petDeposit: EvidenceField<number | null>;
  oneTimePetFee: EvidenceField<number | null>;
  petWeightLimit: EvidenceField<string | number | null>;
  breedRestrictions: EvidenceField<string | null>;
  parkingFee: EvidenceField<number | null>;
  parkingPolicy: EvidenceField<string | null>;
  utilitiesIncluded: EvidenceField<string | null>;
  amenityFee: EvidenceField<number | null>;
  applicationFee: EvidenceField<number | null>;
  adminFee: EvidenceField<number | null>;
  securityDeposit: EvidenceField<number | null>;

  // ── Richer signals from extraction (optional; existing fields above stay canonical) ──
  /** Species-specific pet flags, distinct from the combined `petAllowed`. */
  dogsAllowed?: EvidenceField<boolean | null>;
  catsAllowed?: EvidenceField<boolean | null>;
  maxPets?: EvidenceField<number | null>;
  petScreening?: EvidenceField<boolean | null>;
  parkingType?: EvidenceField<string | null>;
  evCharging?: EvidenceField<boolean | null>;
  amenities?: PropertyAmenities;
  /** Property-level facts the extractor flagged as not found / ambiguous / contradictory. */
  missingCriticalFacts?: string[];
  conflictingFacts?: string[];
  notes?: string[];
};

export type DiscoveredAsset = {
  propertyId: string;
  unitId?: string;
  type:
    | "floor_plan_image"
    | "floor_plan_pdf"
    | "fee_sheet"
    | "pet_policy_page"
    | "parking_page"
    | "brochure"
    | "lease_related_doc"
    | "unit_listing"
    | "faq_page"
    | "amenities_page";
  url: string;
  sourcePageUrl?: string;
  boxFileId?: string;
  confidence: "high" | "medium" | "low";
};

export type RoomSignal = {
  type:
    | "bedroom"
    | "bathroom"
    | "living_room"
    | "kitchen"
    | "closet"
    | "walk_in_closet"
    | "dining"
    | "balcony"
    | "laundry"
    | "entry";
  labelFromPlan?: string;
  dimensionsText?: string;
  widthFt?: number;
  lengthFt?: number;
  areaSqft?: number;
  features: string[];
  limitations: string[];
  confidence: "high" | "medium" | "low";
  evidenceDescription: string;
};

export type FloorPlanAnalysis = {
  unitId: string;
  floorPlanName?: string;
  rooms: {
    bedrooms: RoomSignal[];
    bathrooms: RoomSignal[];
    livingRooms: RoomSignal[];
    kitchens: RoomSignal[];
    closets: RoomSignal[];
    walkInClosets: RoomSignal[];
    diningAreas: RoomSignal[];
    balconies: RoomSignal[];
    laundryAreas: RoomSignal[];
  };
  layoutSignals: {
    hasWalkInCloset: EvidenceField<boolean | null>;
    hasInUnitLaundry: EvidenceField<boolean | null>;
    hasKitchenIsland: EvidenceField<boolean | null>;
    hasBalconyOrPatio: EvidenceField<boolean | null>;
    bathroomAccess: EvidenceField<"hallway" | "bedroom_ensuite" | "unclear" | null>;
    openKitchenLiving: EvidenceField<boolean | null>;
  };
  usabilityScores: {
    bedroomFitScore: number;
    wfhFitScore: number;
    closetStorageScore: number;
    kitchenUsabilityScore: number;
    livingRoomUsabilityScore: number;
    bathroomConvenienceScore: number;
    /** Combined living/dining score (alias used by some extractors). */
    livingDiningScore?: number;
  };
  confidence: "high" | "medium" | "low";
  notes: string[];

  // ── Narrative outputs from richer vision analysis (optional) ──
  insights?: string[];
  caveats?: string[];
  /** Things the user should confirm in person during a tour. */
  tourVerification?: string[];
};

/** Textual layout signals extracted per unit (each a short evidence-backed note). */
export type UnitLayoutSignals = {
  bedroom?: EvidenceField<string | null>;
  bathroom?: EvidenceField<string | null>;
  kitchen?: EvidenceField<string | null>;
  livingDining?: EvidenceField<string | null>;
  balconyOutdoor?: EvidenceField<string | null>;
  closetStorage?: EvidenceField<string | null>;
  wfh?: EvidenceField<string | null>;
};

export type UnitCandidate = {
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitName: string;
  floorPlanName?: string;
  rent: EvidenceField<number | null>;
  sqft: EvidenceField<number | null>;
  bedrooms: EvidenceField<number | null>;
  bathrooms: EvidenceField<number | null>;
  availableDate: EvidenceField<string | null>;
  floorPlanAssets: DiscoveredAsset[];

  // ── Richer unit-level signals from extraction (optional) ──
  availabilityCount?: EvidenceField<number | null>;
  leaseTerm?: EvidenceField<string | null>;
  layoutSignals?: UnitLayoutSignals;
  /** Unit-level facts the extractor flagged as not found, and free-form notes. */
  missingFacts?: string[];
  extractionNotes?: string[];

  viability?: "viable" | "maybe_viable_needs_clarification" | "not_viable";
  preVisionScore?: number;
  floorPlanAnalysis?: FloorPlanAnalysis;
  floorPlanComparison?: Partial<FloorPlanComparison>;
  finalScore?: number;
  tourPriority?: "tour_first" | "backup" | "ask_before_touring" | "skip";
};

export type PropertyCandidate = {
  propertyId: string;
  name: string;
  url: string;
  boxFolderId?: string;
  propertyFacts?: PropertyFacts;
  units: UnitCandidate[];
  propertySummary?: {
    viableUnitCount: number;
    bestUnitIds: string[];
    missingPropertyQuestions: string[];
    tourRecommendation: "tour" | "ask_first" | "skip";
  };
};

export type ComponentComparison = {
  component:
    | "bedroom"
    | "bathroom"
    | "closet_storage"
    | "kitchen"
    | "living_room"
    | "wfh";
  rankings: {
    unitId: string;
    rank: number;
    score: number;
    summary: string;
    evidence: string[];
    caveats: string[];
  }[];
  winnerUnitId?: string;
  keyTradeoff: string;
};

export type FloorPlanComparison = {
  bedroomComparison: ComponentComparison;
  bathroomComparison: ComponentComparison;
  closetStorageComparison: ComponentComparison;
  kitchenComparison: ComponentComparison;
  livingRoomComparison: ComponentComparison;
  wfhComparison: ComponentComparison;
};

export type JudgeFinding = {
  severity: "blocker" | "warning" | "info";
  field: string;
  issue: string;
  suggestedFix: string;
};

export type JudgeResult = {
  passed: boolean;
  score: number;
  findings: JudgeFinding[];
};

export type EvidenceItem = {
  label: string;
  value: string;
  status: EvidenceStatus;
  sourceUrl?: string;
  snippet?: string;
};

export type RankedUnitCard = {
  unitId: string;
  propertyId: string;
  propertyName: string;
  unitName: string;
  floorPlanName?: string;
  rank: number;
  overallScore: number;
  trueMonthlyCostKnown?: number;
  budgetStatus: "within_budget" | "near_budget" | "over_budget" | "unknown";
  tourPriority: "tour_first" | "backup" | "ask_before_touring" | "skip";
  scores: {
    cost: number;
    petFit: number;
    wfhFit: number;
    parking: number;
    storage: number;
    evidenceCompleteness: number;
  };
  costBreakdown: {
    baseRent?: number;
    parkingFee?: number;
    petRent?: number;
    amenityFee?: number;
    knownMonthlyTotal?: number;
    unknownCostFields: string[];
  };
  floorPlanSignals: {
    bedroomDimensions?: string;
    livingRoomDimensions?: string;
    queenBedFit: EvidenceStatus;
    deskFit: EvidenceStatus;
    floorPlanConfidence: "high" | "medium" | "low";
  };
  petSignals: {
    petAllowed: EvidenceStatus;
    petRent?: number;
    petDeposit?: number;
    weightLimit?: string;
    breedRestrictions: EvidenceStatus;
  };
  topReasons: string[];
  risks: string[];
  missingQuestions: string[];
  evidence: EvidenceItem[];
};

export type MissingInfoItem = {
  propertyId: string;
  unitId?: string;
  propertyName: string;
  unitName?: string;
  field: string;
  priority: "blocking" | "important" | "nice_to_have";
  question: string;
  reason: string;
};

export type PropertyRecommendation = {
  propertyId: string;
  propertyName: string;
  tourPriority: "tour_first" | "ask_before_touring" | "skip";
  unitsToAskFor: string[];
  reasons: string[];
  verifyDuringTour: string[];
  askBeforeTouring: string[];
};

export type AnalyzeResponse = {
  summary: {
    propertiesAnalyzed: number;
    unitsFound: number;
    viableUnitsFound: number;
    floorPlansFound: number;
    missingInfoCount: number;
    tourFirstCount: number;
    askBeforeTouringCount: number;
    skipCount: number;
    estimatedTimeSavedMinutes: number;
  };
  tourPlan: {
    tourFirst: PropertyRecommendation[];
    askBeforeTouring: PropertyRecommendation[];
    skip: PropertyRecommendation[];
  };
  rankedUnits: RankedUnitCard[];
  missingInfo: MissingInfoItem[];
  comparisonViews: import("./chartTypes.js").ComparisonViews;
  artifacts: {
    boxProjectUrl?: string;
    comparisonReportBoxUrl?: string;
    missingInfoTrackerBoxUrl?: string;
    tourChecklistBoxUrl?: string;
    leasingQuestionsBoxUrl?: string;
  };
};
