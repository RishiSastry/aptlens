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
import { createBoxProject } from "./nodes/createBoxProject.js";
import { crawlUrls } from "./nodes/crawlUrls.js";
import { extractFacts } from "./nodes/extractFacts.js";
import { analyzeFloorplans } from "./nodes/analyzeFloorplans.js";
import { scoreAndRank } from "./nodes/scoreAndRank.js";
import { generateTourPlan } from "./nodes/generateTourPlan.js";
import { buildComparisonViews } from "./nodes/buildComparisonViews.js";
import { uploadArtifactsToBox } from "./nodes/uploadArtifactsToBox.js";

/**
 * LangGraph state. One channel per PipelineState field; default (replace)
 * reducers mean each node's returned state overwrites prior channel values —
 * identical semantics to the old sequential runner, since every node already
 * threads prior state forward (e.g. `errors: [...state.errors, ...]`).
 */
const PipelineAnnotation = Annotation.Root({
  request: Annotation<AnalyzeRequest>,
  crawlResults: Annotation<Record<string, unknown>>,
  properties: Annotation<PropertyCandidate[]>,
  units: Annotation<UnitCandidate[]>,
  rankedUnits: Annotation<RankedUnitCard[]>,
  tourPlan: Annotation<TourPlan | null>,
  missingInfo: Annotation<MissingInfoItem[]>,
  comparisonViews: Annotation<ComparisonViews | null>,
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

/**
 * The AptLens pipeline as a LangGraph StateGraph:
 *   Box workspace → Crawl → Extract → Vision → Score → Plan → Views → Upload
 *
 * Currently a linear chain mirroring the sequential runner. The judge/repair
 * and compare nodes from the plan (Rachel's reasoning layer) slot in later via
 * addConditionalEdges without changing this scaffold.
 */
export const pipelineGraph = new StateGraph(PipelineAnnotation)
  .addNode("createBoxProject", node(createBoxProject))
  .addNode("crawlUrls", node(crawlUrls))
  .addNode("extractFacts", node(extractFacts))
  .addNode("analyzeFloorplans", node(analyzeFloorplans))
  .addNode("scoreAndRank", node(scoreAndRank))
  .addNode("generateTourPlan", node(generateTourPlan))
  .addNode("buildComparisonViews", node(buildComparisonViews))
  .addNode("uploadArtifactsToBox", node(uploadArtifactsToBox))
  .addEdge(START, "createBoxProject")
  .addEdge("createBoxProject", "crawlUrls")
  .addEdge("crawlUrls", "extractFacts")
  .addEdge("extractFacts", "analyzeFloorplans")
  .addEdge("analyzeFloorplans", "scoreAndRank")
  .addEdge("scoreAndRank", "generateTourPlan")
  .addEdge("generateTourPlan", "buildComparisonViews")
  .addEdge("buildComparisonViews", "uploadArtifactsToBox")
  .addEdge("uploadArtifactsToBox", END)
  .compile();
