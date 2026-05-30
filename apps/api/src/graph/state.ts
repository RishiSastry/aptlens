import type {
  AnalyzeRequest,
  PropertyCandidate,
  UnitCandidate,
  RankedUnitCard,
  MissingInfoItem,
  PropertyRecommendation,
} from "@aptlens/shared";
import type { ComparisonViews } from "@aptlens/shared/chartTypes";
import type {
  ApartmentComparisonOut,
  JudgeExtractionsOut,
  JudgeResultOut,
  MissingQuestionsOut,
  TourPlanOut,
  UnitComparisonOut,
} from "./nodes/reasoning/schemas.js";

export type TourPlan = {
  tourFirst: PropertyRecommendation[];
  askBeforeTouring: PropertyRecommendation[];
  skip: PropertyRecommendation[];
};

export type Artifacts = {
  boxProjectUrl?: string;
  comparisonReportBoxUrl?: string;
  missingInfoTrackerBoxUrl?: string;
  tourChecklistBoxUrl?: string;
  leasingQuestionsBoxUrl?: string;
};

/** Shared mutable state threaded through every pipeline step. */
export type PipelineState = {
  request: AnalyzeRequest;

  // Populated by crawlUrls
  crawlResults: Record<string, unknown>;

  // Populated by extractFacts
  properties: PropertyCandidate[];
  units: UnitCandidate[];

  // Populated by scoreAndRank
  rankedUnits: RankedUnitCard[];

  // Populated by generateTourPlan
  tourPlan: TourPlan | null;
  missingInfo: MissingInfoItem[];

  // Populated by buildComparisonViews
  comparisonViews: ComparisonViews | null;

  // Populated by the reasoning layer (LLM tab generators)
  unitComparison: UnitComparisonOut | null;
  apartmentComparison: ApartmentComparisonOut | null;
  missingQuestions: MissingQuestionsOut | null;
  tourPlanTabs: TourPlanOut | null;
  /** Markdown decision packet from generateReport. */
  decisionPacket: string | null;

  // Populated by the judge nodes (quality gates; uploaded to Box judge-results)
  judge: {
    extraction?: JudgeExtractionsOut;
    floorplan?: JudgeResultOut;
    report?: JudgeResultOut;
  };
  /** Judge→repair retry counters (capped to avoid loops). */
  retryCounts: { extraction: number; floorplan: number; report: number };

  // Populated by createBoxProject — folder ids reused by uploadArtifactsToBox
  box: BoxProject | null;

  // Populated by buildReport
  artifacts: Artifacts;

  errors: string[];
};

/** Box folder ids for the current run's project workspace. */
export type BoxProject = {
  projectFolderId: string;
  /** Subfolder name → Box folder id (raw-evidence, properties, units, reports, judge-results). */
  subfolders: Record<string, string>;
};

export function initState(request: AnalyzeRequest): PipelineState {
  return {
    request,
    crawlResults: {},
    properties: [],
    units: [],
    rankedUnits: [],
    tourPlan: null,
    missingInfo: [],
    comparisonViews: null,
    unitComparison: null,
    apartmentComparison: null,
    missingQuestions: null,
    tourPlanTabs: null,
    decisionPacket: null,
    judge: {},
    retryCounts: { extraction: 0, floorplan: 0, report: 0 },
    box: null,
    artifacts: {},
    errors: [],
  };
}
