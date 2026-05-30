import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { ZodSchema } from "zod";
import { loadPrompt, fillPrompt } from "./llm.js";

/**
 * Sends one or more floor-plan images to GPT-4o vision and returns a
 * structured result validated against the provided Zod schema.
 *
 * Always uses OpenAI GPT-4o regardless of VISION_LLM_PROVIDER —
 * Anthropic vision is available but GPT-4o is preferred for floor plans.
 */
export async function analyzeImages<T>(opts: {
  promptFile: string;
  imageUrls: string[];
  vars?: Record<string, string>;
  schema: ZodSchema<T>;
}): Promise<T> {
  const { promptFile, imageUrls, vars = {}, schema } = opts;

  const template = await loadPrompt(promptFile);
  const promptText = fillPrompt(template, vars);

  const imageBlocks = imageUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url },
  }));

  const model = new ChatOpenAI({
    model: "gpt-4o",
    maxRetries: 2,
  }).withStructuredOutput(schema);

  return model.invoke([
    new HumanMessage({
      content: [
        { type: "text", text: promptText },
        ...imageBlocks,
      ],
    }),
  ]) as Promise<T>;
}
