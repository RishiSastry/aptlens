import type { Context } from "hono";
import { analyzeRequestSchema } from "@aptlens/shared/schemas";
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

  // TODO: replace with real pipeline (Task 3)
  return c.json(mockResponse);
}
