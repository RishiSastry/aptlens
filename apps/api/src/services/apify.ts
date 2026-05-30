import { ApifyClient } from "apify-client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CrawledPage = {
  url: string;
  loadedUrl?: string;
  title?: string;
  /** Page text/markdown, used downstream for fact extraction. */
  text?: string;
};

export type CrawledAsset = {
  url: string;
  type: "floor_plan_pdf" | "image" | "pdf" | "other";
  sourcePageUrl?: string;
};

/** Normalized crawl result for a single property, cached to fixtures/apify/<propertyId>.json. */
export type PropertyCrawl = {
  propertyId: string;
  rootUrl: string;
  pages: CrawledPage[];
  assets: CrawledAsset[];
  crawledAt: string;
  source: "live" | "cache";
  /** Raw dataset items, preserved so later nodes can mine anything we didn't normalize. */
  rawItems: unknown[];
};

// ── Crawl config (see plan §15 — Apify Budget and Usage Constraints) ────────────

/** Default actor: Apify's website-content-crawler. Override via APIFY_WEBSITE_CRAWLER_ACTOR_ID. */
const DEFAULT_ACTOR_ID = "apify/website-content-crawler";

const MAX_CRAWL_DEPTH = 2;
const MAX_PAGES_PER_PROPERTY = 25;

/** URL path fragments we never want to spend credits on. */
const EXCLUDED_TERMS = [
  "login",
  "apply",
  "payment",
  "resident-portal",
  "resident-login",
  "blog",
  "news",
  "careers",
  "gallery",
];

function excludeGlobs(): { glob: string }[] {
  return EXCLUDED_TERMS.map((term) => ({ glob: `**/*${term}*/**` }));
}

/** Keep the crawl on the property's own hostname. */
function sameDomainGlob(url: string): { glob: string }[] {
  try {
    const host = new URL(url).hostname;
    return [{ glob: `**://${host}/**` }, { glob: `**://${host}` }];
  } catch {
    return [];
  }
}

// ── Normalization ───────────────────────────────────────────────────────────

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function classifyAsset(url: string): CrawledAsset["type"] {
  const lower = url.toLowerCase();
  if (/\.pdf(\?|$)/.test(lower)) {
    return /floor|plan|fp\b/.test(lower) ? "floor_plan_pdf" : "pdf";
  }
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/.test(lower)) return "image";
  return "other";
}

/** Pull a normalized page + any linked PDF/image assets out of one dataset item. */
function normalizeItem(item: Record<string, unknown>): {
  page: CrawledPage;
  assets: CrawledAsset[];
} {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const crawl = (item.crawl ?? {}) as Record<string, unknown>;
  const url = asString(item.url) ?? asString(crawl.loadedUrl) ?? "";

  const page: CrawledPage = {
    url,
    loadedUrl: asString(crawl.loadedUrl) ?? asString(item.loadedUrl),
    title: asString(metadata.title) ?? asString(item.title),
    text: asString(item.markdown) ?? asString(item.text),
  };

  // The content crawler may surface linked files/images under various keys.
  const linkLists = [item.links, item.fileUrls, item.imageUrls, metadata.links].filter(
    Array.isArray
  ) as unknown[][];
  const assets: CrawledAsset[] = [];
  for (const list of linkLists) {
    for (const raw of list) {
      const link = typeof raw === "string" ? raw : asString((raw as Record<string, unknown>)?.url);
      if (!link) continue;
      const type = classifyAsset(link);
      if (type === "other") continue; // only keep PDFs/images as candidate assets
      assets.push({ url: link, type, sourcePageUrl: url || undefined });
    }
  }

  return { page, assets };
}

// ── Public API ────────────────────────────────────────────────────────────

/** True when a live Apify crawl is possible (token present). */
export function apifyConfigured(): boolean {
  return !!process.env.APIFY_TOKEN;
}

/**
 * Live-crawl a single property site with Apify and return a normalized result.
 * Throws if APIFY_TOKEN is missing or the actor run fails — callers handle fallback.
 */
export async function crawlSite(rootUrl: string, propertyId: string): Promise<PropertyCrawl> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");

  const actorId = process.env.APIFY_WEBSITE_CRAWLER_ACTOR_ID || DEFAULT_ACTOR_ID;
  const client = new ApifyClient({ token });

  const input = {
    startUrls: [{ url: rootUrl }],
    crawlerType: "cheerio", // cheapest; no headless browser
    maxCrawlDepth: MAX_CRAWL_DEPTH,
    maxCrawlPages: MAX_PAGES_PER_PROPERTY,
    maxResults: MAX_PAGES_PER_PROPERTY,
    includeUrlGlobs: sameDomainGlob(rootUrl),
    excludeUrlGlobs: excludeGlobs(),
    saveMarkdown: true,
    saveHtml: false,
  };

  console.log(`[apify] Crawling ${rootUrl} via ${actorId} (depth ${MAX_CRAWL_DEPTH}, ≤${MAX_PAGES_PER_PROPERTY} pages)`);
  const run = await client.actor(actorId).call(input, { timeout: 180, waitSecs: 240 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const pages: CrawledPage[] = [];
  const assets: CrawledAsset[] = [];
  const seenAssets = new Set<string>();
  for (const item of items) {
    const { page, assets: pageAssets } = normalizeItem(item as Record<string, unknown>);
    if (page.url) pages.push(page);
    for (const asset of pageAssets) {
      if (seenAssets.has(asset.url)) continue;
      seenAssets.add(asset.url);
      assets.push(asset);
    }
  }

  console.log(`[apify] ${rootUrl} → ${pages.length} pages, ${assets.length} assets`);

  return {
    propertyId,
    rootUrl,
    pages,
    assets,
    crawledAt: new Date().toISOString(),
    source: "live",
    rawItems: items,
  };
}
