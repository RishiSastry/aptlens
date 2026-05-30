import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { join, dirname } from "path";
import type { ZodType, ZodTypeDef } from "zod";

/** A zod schema whose validated output is T; input may differ (e.g. `.catch()`). */
type OutputSchema<T> = ZodType<T, ZodTypeDef, unknown>;

// ── Types ─────────────────────────────────────────────────────────────────────

export type LLMRole = "text" | "judge" | "vision";

// ── Model factory ─────────────────────────────────────────────────────────────

function getProvider(role: LLMRole): string {
  const map: Record<LLMRole, string> = {
    text:   process.env.TEXT_LLM_PROVIDER   ?? "openai",
    judge:  process.env.JUDGE_LLM_PROVIDER  ?? "anthropic",
    vision: process.env.VISION_LLM_PROVIDER ?? "openai",
  };
  return map[role];
}

/**
 * Returns a LangChain chat model for the given role.
 * Provider is controlled by env vars (TEXT_LLM_PROVIDER, JUDGE_LLM_PROVIDER, VISION_LLM_PROVIDER).
 * Callers can chain .withStructuredOutput(schema) for typed responses.
 */
export function getLLM(role: LLMRole) {
  const provider = getProvider(role);

  if (provider === "anthropic") {
    return new ChatAnthropic({
      model: role === "judge" ? "claude-sonnet-4-6" : "claude-haiku-4-5-20251001",
      maxRetries: 2,
    });
  }

  // default: openai
  return new ChatOpenAI({
    model: role === "vision" ? "gpt-4o" : "gpt-4o-mini",
    maxRetries: 2,
  });
}

// ── Prompt loading ────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "prompts");

const promptCache = new Map<string, string>();

/** Reads a prompt .md file from apps/api/src/prompts/ and caches it. */
export async function loadPrompt(filename: string): Promise<string> {
  const cached = promptCache.get(filename);
  if (cached) return cached;
  const text = await readFile(join(PROMPTS_DIR, filename), "utf-8");
  promptCache.set(filename, text);
  return text;
}

/** Replaces {{variable}} placeholders in a prompt string. */
export function fillPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Structured call helper ────────────────────────────────────────────────────

/**
 * Convenience wrapper: loads a prompt, fills variables, calls the LLM,
 * and returns a validated typed result.
 *
 * @example
 * const result = await callStructured({
 *   role: "text",
 *   promptFile: "extract_property_facts.md",
 *   vars: { pageContent: "..." },
 *   schema: PropertyFactsSchema,
 * });
 */
export async function callStructured<T>(opts: {
  role: LLMRole;
  promptFile: string;
  vars?: Record<string, string>;
  userContent?: string;
  schema: OutputSchema<T>;
}): Promise<T> {
  const { role, promptFile, vars = {}, userContent, schema } = opts;

  const template = await loadPrompt(promptFile);
  const systemText = fillPrompt(template, vars);

  // Always include a human message — Anthropic rejects system-only conversations.
  const messages = [
    new SystemMessage(systemText),
    new HumanMessage(userContent ?? "Produce the structured output now, following the instructions above."),
  ];

  // function-calling structured output — works across OpenAI/Anthropic and
  // tolerates optional/union fields (OpenAI's strict json-schema mode does not).
  const model = getLLM(role).withStructuredOutput(schema, { method: "functionCalling" });
  return model.invoke(messages) as Promise<T>;
}

/** Like callStructured, but returns the model's raw text (e.g. a Markdown report). */
export async function callText(opts: {
  role: LLMRole;
  promptFile: string;
  vars?: Record<string, string>;
  userContent?: string;
}): Promise<string> {
  const { role, promptFile, vars = {}, userContent } = opts;
  const systemText = fillPrompt(await loadPrompt(promptFile), vars);
  const messages = [
    new SystemMessage(systemText),
    ...(userContent ? [new HumanMessage(userContent)] : []),
  ];
  const res = await getLLM(role).invoke(messages);
  return typeof res.content === "string" ? res.content : JSON.stringify(res.content);
}
