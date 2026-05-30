import type { AnalyzeRequest, AnalyzeResponse } from "@aptlens/shared";
import { initState } from "./state.js";
import { crawlUrls } from "./nodes/crawlUrls.js";
import { extractFacts } from "./nodes/extractFacts.js";
import { scoreAndRank } from "./nodes/scoreAndRank.js";
import { generateTourPlan } from "./nodes/generateTourPlan.js";
import { buildComparisonViews } from "./nodes/buildComparisonViews.js";
import { buildReport } from "./nodes/buildReport.js";

/**
 * Sequential pipeline: Input → Crawl → Extract → Score → Plan → Views → Report
 *
 * Each step is a plain async function. Steps are replaced one-by-one as Tasks
 * 4–7 implement the real logic. Task 8 migrates this to a LangGraph graph.
 */
export async function runPipeline(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  let state = initState(request);

  state = await crawlUrls(state);
  state = await extractFacts(state);
  state = await scoreAndRank(state);
  state = await generateTourPlan(state);
  state = await buildComparisonViews(state);

  return buildReport(state);
}
