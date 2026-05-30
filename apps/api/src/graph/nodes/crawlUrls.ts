import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { PipelineState } from "../state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../fixtures/apify");

// TODO (Task 5): replace stub with real Apify crawl
export async function crawlUrls(state: PipelineState): Promise<PipelineState> {
  const { urls } = state.request;
  const useCached = process.env.USE_CACHED_APIFY === "true";
  const hasToken = !!process.env.APIFY_TOKEN;

  if (!hasToken || useCached) {
    console.log(`[crawlUrls] ${useCached ? "Using cached Apify fixtures" : "No APIFY_TOKEN — skipping live crawl"}`);
    const crawlResults: Record<string, unknown> = {};

    for (const url of urls) {
      const propertyId = propertyIdFromUrl(url);
      try {
        const raw = await readFile(join(FIXTURES_DIR, `${propertyId}.json`), "utf-8");
        crawlResults[propertyId] = JSON.parse(raw);
        console.log(`[crawlUrls] Loaded fixture for ${propertyId}`);
      } catch {
        // No fixture file yet — downstream steps will handle empty crawl
        crawlResults[propertyId] = null;
      }
    }

    return { ...state, crawlResults };
  }

  // Real Apify crawl (Task 5)
  console.log(`[crawlUrls] Live Apify crawl for ${urls.length} URLs — not yet implemented`);
  return { ...state, crawlResults: {} };
}

export function propertyIdFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/\./g, "-");
  } catch {
    return url.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  }
}

export function propertyNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0] ?? url;
  } catch {
    return url;
  }
}
