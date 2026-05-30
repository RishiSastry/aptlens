import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { PipelineState } from "../state.js";
import { apifyConfigured, crawlSite, type PropertyCrawl } from "../../services/apify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../fixtures/apify");

/** Load a cached crawl fixture, or null if none exists. */
async function loadFixture(propertyId: string): Promise<PropertyCrawl | null> {
  try {
    const raw = await readFile(join(FIXTURES_DIR, `${propertyId}.json`), "utf-8");
    const parsed = JSON.parse(raw) as PropertyCrawl;
    return { ...parsed, source: "cache" };
  } catch {
    return null;
  }
}

/** Persist a successful live crawl so future dev/demo runs can replay it. */
async function saveFixture(propertyId: string, crawl: PropertyCrawl): Promise<void> {
  try {
    await mkdir(FIXTURES_DIR, { recursive: true });
    await writeFile(join(FIXTURES_DIR, `${propertyId}.json`), JSON.stringify(crawl, null, 2), "utf-8");
    console.log(`[crawlUrls] Cached crawl for ${propertyId}`);
  } catch (err) {
    console.warn(`[crawlUrls] Failed to cache crawl for ${propertyId}:`, err);
  }
}

/**
 * Crawl every property URL with Apify, caching results to fixtures.
 *
 * Tiered behavior (plan §15):
 *   - USE_CACHED_APIFY=true or no APIFY_TOKEN → serve cached fixtures only (no credits burned)
 *   - otherwise → live crawl, cache the result, and fall back to cache if the crawl fails
 */
export async function crawlUrls(state: PipelineState): Promise<PipelineState> {
  const { urls } = state.request;
  const useCached = process.env.USE_CACHED_APIFY === "true";
  const live = apifyConfigured() && !useCached;

  console.log(
    `[crawlUrls] ${live ? "Live Apify crawl" : useCached ? "Using cached Apify fixtures" : "No APIFY_TOKEN — cache only"} for ${urls.length} URLs`
  );

  const crawlResults: Record<string, unknown> = {};
  const errors = [...state.errors];

  for (const url of urls) {
    const propertyId = propertyIdFromUrl(url);

    if (!live) {
      const fixture = await loadFixture(propertyId);
      crawlResults[propertyId] = fixture;
      if (fixture) console.log(`[crawlUrls] Loaded fixture for ${propertyId}`);
      else errors.push(`No cached crawl for ${propertyId} (${url})`);
      continue;
    }

    try {
      const crawl = await crawlSite(url, propertyId);
      crawlResults[propertyId] = crawl;
      await saveFixture(propertyId, crawl);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[crawlUrls] Live crawl failed for ${propertyId}: ${reason} — trying cache`);
      const fixture = await loadFixture(propertyId);
      crawlResults[propertyId] = fixture;
      errors.push(
        fixture
          ? `Live crawl failed for ${propertyId}; used cached crawl (${reason})`
          : `Crawl failed for ${propertyId} and no cache available (${reason})`
      );
    }
  }

  return { ...state, crawlResults, errors };
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
