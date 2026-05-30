import type {
  AnalyzeRequest,
  PropertyCandidate,
  UnitCandidate,
  RankedUnitCard,
  MissingInfoItem,
  PropertyRecommendation,
} from "@aptlens/shared";
import type { ComparisonViews } from "@aptlens/shared/chartTypes";

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

  // Populated by buildReport
  artifacts: Artifacts;

  errors: string[];
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
    artifacts: {},
    errors: [],
  };
}
