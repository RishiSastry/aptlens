# AptLens

Pre-tour apartment due-diligence workflow.

Paste apartment URLs and your constraints. AptLens crawls each site with Apify, extracts pet policies, fees, parking, and floor-plan assets, judges extraction quality, ranks units against your preferences, and generates a tour-ready decision packet saved to Box.

**The key output:**
> "Tour these properties, ask to see these units, email these questions before touring, and skip these options because they don't meet your constraints."

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, Vite, TypeScript, Recharts |
| Backend | Node.js, Hono, LangGraph.js, Zod |
| Crawling | Apify |
| Storage | Box |
| LLMs | OpenAI (extraction, vision), Anthropic (judge nodes) |
| Monorepo | pnpm workspaces + Turborepo |

---

## Repo structure

```
aptlens/
  apps/
    web/        React frontend (intake form, progress, results dashboard)
    api/        Hono server + LangGraph pipeline
  packages/
    shared/     Types, Zod schemas, scoring logic (used by both apps)
```

---

## Quick start

**Prerequisites:** Node >= 20, pnpm >= 9

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env and fill in your keys
cp .env.example .env

# 3. Run both apps in dev mode
pnpm dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8000

To run individually:

```bash
pnpm dev:web   # frontend only
pnpm dev:api   # backend only
```

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `APIFY_TOKEN` | apify.com → Settings → Integrations |
| `BOX_DEVELOPER_TOKEN` | developer.box.com → My Apps → your app → Developer Token |
| `OPENAI_API_KEY` | platform.openai.com |
| `ANTHROPIC_API_KEY` | console.anthropic.com |

Set `USE_CACHED_APIFY=true` during development to avoid burning Apify credits.

---

## LangGraph pipeline

```
normalizeUserRequest → createBoxProject → crawlUrls → discoverAssetsAndUnits
  → extractPropertyFacts → extractUnitCandidates
  → judgeExtractions ⟲ repairOrMarkMissing
  → filterUnitsByHardConstraints → triageRankUnits → selectUnitsForDeepAnalysis
  → analyzeFloorplansWithVision
  → judgeFloorplanAnalysis ⟲ repairFloorplanOrDowngradeConfidence
  → compareFloorplanComponents → computeFinalScores → groupResultsByProperty
  → generateMissingInfoQuestions → generateTourPlan → buildComparisonViews
  → generateDecisionPacket
  → judgeDecisionPacket ⟲ repairDecisionPacket
  → uploadArtifactsToBox
```

Nodes live in `apps/api/src/graph/nodes/`.

---

## Implementation order

See `AGENTS.md` for the step-by-step build sequence and conventions.
