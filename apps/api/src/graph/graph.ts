import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import type {
  AnalyzeRequest,
  MissingInfoItem,
  PropertyCandidate,
  RankedUnitCard,
  UnitCandidate,
} from "@aptlens/shared";
import type { ComparisonViews } from "@aptlens/shared/chartTypes";
import type { Artifacts, BoxProject, PipelineState, TourPlan } from "./state.js";
import type {
  ApartmentComparisonOut,
  JudgeExtractionsOut,
  JudgeResultOut,
  MissingQuestionsOut,
  TourPlanOut,
  UnitComparisonOut,
} from "./nodes/reasoning/schemas.js";
import { createBoxProject } from "./nodes/createBoxProject.js";
import { crawlUrls } from "./nodes/crawlUrls.js";
import { extractFacts } from "./nodes/extractFacts.js";
import { analyzeFloorplans } from "./nodes/analyzeFloorplans.js";
import { scoreAndRank } from "./nodes/scoreAndRank.js";
import { generateTourPlan } from "./nodes/generateTourPlan.js";
import { buildComparisonViews } from "./nodes/buildComparisonViews.js";
import { uploadArtifactsToBox } from "./nodes/uploadArtifactsToBox.js";
import { judgeExtractions, repairExtractions, extractionNeedsRepair } from "./nodes/reasoning/judgeExtractions.js";
import { judgeFloorplanAnalysis, repairFloorplan, floorplanNeedsRepair } from "./nodes/reasoning/judgeFloorplan.js";
import { compareFloorplans } from "./nodes/reasoning/compareFloorplans.js";
import { generateMissingQuestions } from "./nodes/reasoning/generateMissingQuestions.js";
import { generateTourPlanLLM } from "./nodes/reasoning/generateTourPlanLLM.js";
import { generateReport, judgeReport, repairReport, reportNeedsRepair } from "./nodes/reasoning/generateReport.js";

/** LangGraph state — one channel per PipelineState field (default replace reducers). */
const PipelineAnnotation = Annotation.Root({
  request: Annotation<AnalyzeRequest>,
  crawlResults: Annotation<Record<string, unknown>>,
  properties: Annotation<PropertyCandidate[]>,
  units: Annotation<UnitCandidate[]>,
  rankedUnits: Annotation<RankedUnitCard[]>,
  tourPlan: Annotation<TourPlan | null>,
  missingInfo: Annotation<MissingInfoItem[]>,
  comparisonViews: Annotation<ComparisonViews | null>,
  unitComparison: Annotation<UnitComparisonOut | null>,
  apartmentComparison: Annotation<ApartmentComparisonOut | null>,
  missingQuestions: Annotation<MissingQuestionsOut | null>,
  tourPlanTabs: Annotation<TourPlanOut | null>,
  decisionPacket: Annotation<string | null>,
  judge: Annotation<{ extraction?: JudgeExtractionsOut; floorplan?: JudgeResultOut; report?: JudgeResultOut }>,
  retryCounts: Annotation<{ extraction: number; floorplan: number; report: number }>,
  box: Annotation<BoxProject | null>,
  artifacts: Annotation<Artifacts>,
  errors: Annotation<string[]>,
});

type GraphState = typeof PipelineAnnotation.State;

/** Adapt an existing `(PipelineState) => Promise<PipelineState>` node to a graph node. */
const node =
  (fn: (s: PipelineState) => Promise<PipelineState>) =>
  async (s: GraphState): Promise<Partial<GraphState>> =>
    fn(s as PipelineState);

const route = (fn: (s: PipelineState) => boolean) => (s: GraphState) => (fn(s as PipelineState) ? "repair" : "continue");

/**
 * Full AptLens pipeline. Linear backbone with three judge→repair loops
 * (extraction, floor-plan vision, report), each capped at 2 retries:
 *
 *   Box → Crawl → Extract → [judge⇄repair] → Vision → [judge⇄repair] → Score →
 *   TourPlan → MissingQ → Compare → TourPlanLLM → Views → Report → [judge⇄repair] → Upload
 */
export const pipelineGraph = new StateGraph(PipelineAnnotation)
  .addNode("createBoxProject", node(createBoxProject))
  .addNode("crawlUrls", node(crawlUrls))
  .addNode("extractFacts", node(extractFacts))
  .addNode("judgeExtractions", node(judgeExtractions))
  .addNode("repairExtractions", node(repairExtractions))
  .addNode("analyzeFloorplans", node(analyzeFloorplans))
  .addNode("judgeFloorplanAnalysis", node(judgeFloorplanAnalysis))
  .addNode("repairFloorplan", node(repairFloorplan))
  .addNode("scoreAndRank", node(scoreAndRank))
  .addNode("generateTourPlan", node(generateTourPlan))
  .addNode("generateMissingQuestions", node(generateMissingQuestions))
  .addNode("compareFloorplans", node(compareFloorplans))
  .addNode("generateTourPlanLLM", node(generateTourPlanLLM))
  .addNode("buildComparisonViews", node(buildComparisonViews))
  .addNode("generateReport", node(generateReport))
  .addNode("judgeReport", node(judgeReport))
  .addNode("repairReport", node(repairReport))
  .addNode("uploadArtifactsToBox", node(uploadArtifactsToBox))
  .addEdge(START, "createBoxProject")
  .addEdge("createBoxProject", "crawlUrls")
  .addEdge("crawlUrls", "extractFacts")
  .addEdge("extractFacts", "judgeExtractions")
  .addConditionalEdges("judgeExtractions", route(extractionNeedsRepair), {
    repair: "repairExtractions",
    continue: "analyzeFloorplans",
  })
  .addEdge("repairExtractions", "judgeExtractions")
  .addEdge("analyzeFloorplans", "judgeFloorplanAnalysis")
  .addConditionalEdges("judgeFloorplanAnalysis", route(floorplanNeedsRepair), {
    repair: "repairFloorplan",
    continue: "scoreAndRank",
  })
  .addEdge("repairFloorplan", "judgeFloorplanAnalysis")
  .addEdge("scoreAndRank", "generateTourPlan")
  .addEdge("generateTourPlan", "generateMissingQuestions")
  .addEdge("generateMissingQuestions", "compareFloorplans")
  .addEdge("compareFloorplans", "generateTourPlanLLM")
  .addEdge("generateTourPlanLLM", "buildComparisonViews")
  .addEdge("buildComparisonViews", "generateReport")
  .addEdge("generateReport", "judgeReport")
  .addConditionalEdges("judgeReport", route(reportNeedsRepair), {
    repair: "repairReport",
    continue: "uploadArtifactsToBox",
  })
  .addEdge("repairReport", "judgeReport")
  .addEdge("uploadArtifactsToBox", END)
  .compile();
