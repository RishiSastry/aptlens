import type { Context } from "hono";
import { analyzeRequestSchema } from "@aptlens/shared/schemas";
import { runPipeline } from "../graph/runner.js";
import { mockResponse } from "../fixtures/mockResponse.js";

export async function analyzeHandler(c: Context) {
  const body = await c.req.json();
  const parsed = analyzeRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400
    );
  }

  // DEMO_MODE=true bypasses the pipeline and returns the rich mock dataset.
  // Useful for UI development and live demos when APIs aren't configured.
  if (process.env.DEMO_MODE === "true") {
    return c.json(mockResponse);
  }

  try {
    const result = await runPipeline(parsed.data);
    return c.json(result);
  } catch (err) {
    console.error("[analyzeHandler] Pipeline error:", err);
    return c.json({ error: "Pipeline failed", details: String(err) }, 500);
  }
}
