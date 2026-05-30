import type { AnalyzeRequest, AnalyzeResponse } from "@aptlens/shared";
import { initState, type PipelineState } from "./state.js";
import { pipelineGraph } from "./graph.js";
import { buildReport } from "./nodes/buildReport.js";

/**
 * Run the AptLens pipeline (a LangGraph StateGraph) and assemble the response.
 *
 * Graph stages: Box workspace → Crawl → Extract → Vision → Score → Plan → Views → Upload.
 * `buildReport` runs after the graph because it returns the API response shape
 * (AnalyzeResponse) rather than a state update.
 */
export async function runPipeline(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const finalState = (await pipelineGraph.invoke(initState(request))) as PipelineState;
  return buildReport(finalState);
}
