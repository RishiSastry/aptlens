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
  type: "floor_plan_image" | "floor_plan_pdf" | "image" | "pdf" | "other";
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

/**
 * Crawler engine. `cheerio` (default) is a cheap raw-HTTP client — fine for
 * server-rendered text, but it misses JS-loaded content like per-unit floor-plan
 * images. Set APIFY_CRAWLER_TYPE=playwright:adaptive to render JS (costs more
 * credits) when a site hides floor plans behind client-side rendering.
 */
const DEFAULT_CRAWLER_TYPE = "cheerio";
function crawlerType(): string {
  return process.env.APIFY_CRAWLER_TYPE || DEFAULT_CRAWLER_TYPE;
}

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

/**
 * Apify proxy config. Defaults to the shared Apify proxy; set
 * APIFY_PROXY_GROUPS=RESIDENTIAL (comma-separated) to use residential proxies,
 * which are often required to get past anti-bot 403s on managed-property sites.
 */
function proxyConfig(): Record<string, unknown> {
  const groups = process.env.APIFY_PROXY_GROUPS?.split(",").map((g) => g.trim()).filter(Boolean);
  return groups?.length
    ? { useApifyProxy: true, apifyProxyGroups: groups }
    : { useApifyProxy: true };
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
  // RentCafe-style brochure endpoints render a floor-plan PDF (no .pdf extension).
  if (/brochure/.test(lower)) return "floor_plan_pdf";
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

  const markdown = asString(item.markdown);
  const page: CrawledPage = {
    url,
    loadedUrl: asString(crawl.loadedUrl) ?? asString(item.loadedUrl),
    title: asString(metadata.title) ?? asString(item.title),
    text: markdown ?? asString(item.text),
  };

  // Collect candidate asset URLs from two sources:
  //   1. structured link arrays, if the actor provides them
  //   2. image/PDF URLs embedded in the page markdown (what website-content-crawler
  //      actually returns — it has no links[] field), e.g. ![alt](https://…/plan.png)
  const candidateUrls: string[] = [];
  const linkLists = [item.links, item.fileUrls, item.imageUrls, metadata.links].filter(
    Array.isArray
  ) as unknown[][];
  for (const list of linkLists) {
    for (const raw of list) {
      const link = typeof raw === "string" ? raw : asString((raw as Record<string, unknown>)?.url);
      if (link) candidateUrls.push(link);
    }
  }
  if (markdown) candidateUrls.push(...extractMarkdownAssetUrls(markdown));

  const assets: CrawledAsset[] = [];
  const seen = new Set<string>();
  for (const link of candidateUrls) {
    if (seen.has(link)) continue;
    seen.add(link);
    const type = classifyAsset(link);
    if (type === "other") continue; // only keep PDFs/images as candidate assets
    assets.push({ url: link, type, sourcePageUrl: url || undefined });
  }

  return { page, assets };
}

/** Pull image/PDF URLs out of markdown — both `![](url)` images and bare file links. */
function extractMarkdownAssetUrls(markdown: string): string[] {
  const urls: string[] = [];
  const mdImage = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
  const bareFile = /https?:\/\/[^\s)\]]+\.(?:jpg|jpeg|png|webp|gif|svg|pdf)(?:\?[^\s)\]]*)?/gi;
  for (const m of markdown.matchAll(mdImage)) urls.push(m[1]!);
  for (const m of markdown.matchAll(bareFile)) urls.push(m[0]);
  return urls;
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

  const engine = crawlerType();
  const input = {
    startUrls: [{ url: rootUrl }],
    crawlerType: engine,
    maxCrawlDepth: MAX_CRAWL_DEPTH,
    maxCrawlPages: MAX_PAGES_PER_PROPERTY,
    maxResults: MAX_PAGES_PER_PROPERTY,
    includeUrlGlobs: sameDomainGlob(rootUrl),
    excludeUrlGlobs: excludeGlobs(),
    saveMarkdown: true,
    proxyConfiguration: proxyConfig(),
  };

  console.log(`[apify] Crawling ${rootUrl} via ${actorId} [${engine}] (depth ${MAX_CRAWL_DEPTH}, ≤${MAX_PAGES_PER_PROPERTY} pages)`);
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

  // Second pass: harvest floor-plan image/PDF URLs from the rendered DOM, which
  // the text crawler can't see (they live in JS widgets / per-unit pages).
  try {
    const planAssets = await scrapeFloorPlanAssets(rootUrl, client);
    for (const asset of planAssets) {
      const existing = assets.find((a) => a.url === asset.url);
      if (existing) {
        // The text crawler may have already added this URL as a generic "image".
        // The scraper's classification is more specific — upgrade to it.
        if (asset.type === "floor_plan_image" || asset.type === "floor_plan_pdf") {
          existing.type = asset.type;
        }
      } else {
        seenAssets.add(asset.url);
        assets.push(asset);
      }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[apify] Floor-plan asset scrape failed for ${rootUrl}: ${reason}`);
  }

  console.log(
    `[apify] ${rootUrl} → ${pages.length} pages, ${assets.length} assets ` +
      `(${assets.filter((a) => a.type === "floor_plan_pdf").length} plan PDFs, ` +
      `${assets.filter((a) => a.type === "floor_plan_image").length} plan images)`
  );

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

// ── Floor-plan asset discovery (apify/web-scraper, rendered DOM) ──────────────

const FLOOR_PLAN_SCRAPER_ACTOR = "apify/web-scraper";

/**
 * Browser-rendered pageFunction (runs on Apify, not here). Drills into floor-plan
 * pages and returns plan-image + PDF URLs from the live DOM. Flags images as
 * "plan" when alt/src hints a floor plan, or when a sizable image sits on a
 * floor-plan/unit detail page.
 */
const FLOOR_PLAN_PAGE_FUNCTION = `
async function pageFunction(context) {
  const { request } = context;

  // Incrementally scroll so EVERY section passes through the viewport — this is
  // what triggers intersection-observer lazy-loading (jumping to the bottom skips
  // the middle gallery and the plan images never load). Stop once they appear.
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    if (document.querySelector('img[alt*="loor"]')) break;
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 1000));

  const onPlanPage = /floor.?plan|\\/unit|\\/availab/.test(location.pathname.toLowerCase());
  const EXCLUDE = /icon|logo|sprite|thumb|badge|banner|favicon|hero|\\bmeta\\b|og[-_]|spinner|placeholder/i;
  const STRONG = /floor.?plan|\\bfp\\b/i;                                   // explicit "floor plan"
  const UNIT = /studio|\\d\\s*bed|\\d\\s*bath|sq\\.?\\s?ft|\\bplan\\b|\\b\\dx\\d\\b/i; // unit-ish alt text

  const all = Array.from(document.querySelectorAll('img'));
  const srcOf = (img) => img.currentSrc || img.src || img.getAttribute('data-src') || '';

  // Floor-plan thumbnails are often duplicated (grid + lightbox); count occurrences.
  const counts = {};
  all.forEach((img) => { const s = srcOf(img); if (s) counts[s] = (counts[s] || 0) + 1; });

  const planImages = new Set();
  const otherImages = new Set();
  all.forEach((img) => {
    const src = srcOf(img);
    if (!src || !/^https?:/i.test(src)) return; // skip data: URIs, tracking pixels
    const alt = img.getAttribute('alt') || '';
    if (EXCLUDE.test(src) || EXCLUDE.test(alt)) { otherImages.add(src); return; }
    const raster = /\\.(png|jpe?g|webp)(\\?|$)/i.test(src);
    const big = (img.naturalWidth || img.width || 0) >= 350;
    const dup = (counts[src] || 0) >= 2;
    const isPlan =
      STRONG.test(src) || STRONG.test(alt) || UNIT.test(alt) || (onPlanPage && raster && (big || dup));
    if (isPlan) planImages.add(src);
    else otherImages.add(src);
  });

  const pdfs = new Set();
  document.querySelectorAll('a[href]').forEach((a) => {
    const h = a.href || '';
    if (/\\.pdf(\\?|$)|brochure/i.test(h)) pdfs.add(h);
  });

  return { url: request.url, planImages: [...planImages], otherImages: [...otherImages], pdfs: [...pdfs] };
}
`;

/** Run the web-scraper pass and return classified floor-plan assets for a site. */
async function scrapeFloorPlanAssets(rootUrl: string, client: ApifyClient): Promise<CrawledAsset[]> {
  let origin = "";
  try {
    origin = new URL(rootUrl).origin;
  } catch {
    return [];
  }

  const input = {
    startUrls: [{ url: rootUrl }],
    // Follow same-domain floor-plan / unit / availability / brochure links only.
    globs: [
      `${origin}/**floorplan**`,
      `${origin}/**floor-plan**`,
      `${origin}/**/units/**`,
      `${origin}/**availab**`,
      `${origin}/**brochure**`,
    ].map((glob) => ({ glob })),
    linkSelector: "a[href]",
    pageFunction: FLOOR_PLAN_PAGE_FUNCTION,
    proxyConfiguration: proxyConfig(),
    maxPagesPerCrawl: MAX_PAGES_PER_PROPERTY,
    maxCrawlingDepth: MAX_CRAWL_DEPTH,
    maxResults: MAX_PAGES_PER_PROPERTY,
  };

  console.log(`[apify] Scraping floor-plan assets for ${rootUrl} via ${FLOOR_PLAN_SCRAPER_ACTOR}`);
  const run = await client.actor(FLOOR_PLAN_SCRAPER_ACTOR).call(input, { timeout: 240, waitSecs: 300 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  const out: CrawledAsset[] = [];
  const seen = new Set<string>();
  const add = (url: unknown, sourcePageUrl: string, forcePlan: boolean) => {
    if (typeof url !== "string" || !/^https?:/i.test(url) || seen.has(url)) return;
    seen.add(url);
    let type = classifyAsset(url);
    // The pageFunction already judged these to be floor plans — trust it even when
    // the URL has no recognizable image extension (common on CDN-hosted plans).
    if (forcePlan && type !== "floor_plan_pdf" && type !== "pdf") type = "floor_plan_image";
    if (type === "other") return;
    out.push({ url, type, sourcePageUrl });
  };

  for (const raw of items) {
    const item = raw as { url?: string; planImages?: unknown[]; pdfs?: unknown[] };
    const src = typeof item.url === "string" ? item.url : rootUrl;
    for (const u of item.planImages ?? []) add(u, src, true);
    for (const u of item.pdfs ?? []) add(u, src, false);
  }
  return out;
}
