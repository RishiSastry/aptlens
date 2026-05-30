import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";
import type { ZodSchema } from "zod";
import { loadPrompt, fillPrompt } from "./llm.js";

/** A floor-plan asset to analyze, tagged by format. */
export type VisionAsset = { url: string; type: string };

const isPdf = (a: VisionAsset): boolean => /pdf/i.test(a.type) || /\.pdf(\?|$)|brochure/i.test(a.url);

/**
 * Analyze floor-plan assets (images and/or PDFs) and return a structured result
 * validated against `schema`.
 *
 * Routing: raster images → OpenAI GPT-4o vision (`image_url`); PDFs → Anthropic
 * Claude (native `document` blocks — no PDF→image conversion needed). When both
 * are present, images win (cleaner signal). Throws if no usable asset/key — the
 * caller degrades gracefully.
 */
export async function analyzeFloorPlanAssets<T>(opts: {
  promptFile: string;
  assets: VisionAsset[];
  vars?: Record<string, string>;
  schema: ZodSchema<T>;
}): Promise<T> {
  const { promptFile, assets, vars = {}, schema } = opts;
  const promptText = fillPrompt(await loadPrompt(promptFile), vars);

  const images = assets.filter((a) => !isPdf(a));
  const pdfs = assets.filter(isPdf);
  const provider = process.env.VISION_LLM_PROVIDER ?? "openai";
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  // Images: GPT-4o when OpenAI is the configured/available provider, else Claude.
  if (images.length > 0 && provider !== "anthropic" && hasOpenAI) {
    return analyzeWithOpenAI(promptText, images.map((a) => a.url), schema);
  }
  // Claude handles images (URL/base64) and PDFs (document blocks) natively.
  if ((images.length > 0 || pdfs.length > 0) && hasAnthropic) {
    return analyzeWithClaude(promptText, images.map((a) => a.url), pdfs.map((a) => a.url), schema);
  }
  // Only path left: images but OpenAI is the sole provider.
  if (images.length > 0 && hasOpenAI) {
    return analyzeWithOpenAI(promptText, images.map((a) => a.url), schema);
  }
  throw new Error(
    `No analyzable asset for available providers (images=${images.length}, pdfs=${pdfs.length}, ` +
      `openai=${hasOpenAI}, anthropic=${hasAnthropic})`
  );
}

/** Back-compat: analyze raster floor-plan images with GPT-4o. */
export async function analyzeImages<T>(opts: {
  promptFile: string;
  imageUrls: string[];
  vars?: Record<string, string>;
  schema: ZodSchema<T>;
}): Promise<T> {
  const promptText = fillPrompt(await loadPrompt(opts.promptFile), opts.vars ?? {});
  return analyzeWithOpenAI(promptText, opts.imageUrls, opts.schema);
}

async function analyzeWithOpenAI<T>(
  promptText: string,
  imageUrls: string[],
  schema: ZodSchema<T>
): Promise<T> {
  // function-calling (not strict json-schema) — tolerates optional/union fields.
  const model = new ChatOpenAI({ model: "gpt-4o", maxRetries: 2 }).withStructuredOutput(schema, {
    method: "functionCalling",
  });
  const content = [
    { type: "text" as const, text: promptText },
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
  return model.invoke([new HumanMessage({ content })]) as Promise<T>;
}

async function analyzeWithClaude<T>(
  promptText: string,
  imageUrls: string[],
  pdfUrls: string[],
  schema: ZodSchema<T>
): Promise<T> {
  const fetched = await Promise.all([
    ...imageUrls.map((u) => fetchAsBase64(u, "image")),
    ...pdfUrls.map((u) => fetchAsBase64(u, "application/pdf")),
  ]);

  const blocks = fetched
    .filter((f): f is { data: string; mediaType: string } => !!f)
    .map((f) =>
      f.mediaType === "application/pdf"
        ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: f.data } }
        : { type: "image" as const, source: { type: "base64" as const, media_type: f.mediaType, data: f.data } }
    );

  if (blocks.length === 0) throw new Error("No image/PDF asset could be fetched for analysis");

  const model = new ChatAnthropic({ model: "claude-sonnet-4-6", maxRetries: 2 }).withStructuredOutput(schema);
  const content = [{ type: "text" as const, text: promptText }, ...blocks];
  return model.invoke([new HumanMessage({ content })]) as Promise<T>;
}

/**
 * Fetch an asset and base64-encode it. `kind` is "application/pdf" or "image"
 * (media type resolved from the response). Returns null on failure (anti-bot, 404).
 */
async function fetchAsBase64(
  url: string,
  kind: "application/pdf" | "image"
): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AptLens/1.0)", Accept: "*/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type")?.split(";")[0]?.trim();
    const mediaType =
      kind === "application/pdf" ? "application/pdf" : ct && ct.startsWith("image/") ? ct : "image/png";
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}
