# AptLens — Agent & Contributor Guide

This file is the primary reference for AI agents (Claude Code, Codex, etc.) and human contributors working on AptLens. Read it before making changes.

---

## Prerequisites & first-time setup

### 1. Install Node.js >= 20

Check your version:
```bash
node --version
```

If it's below 20, install via [nvm](https://github.com/nvm-sh/nvm) (recommended) or [nodejs.org](https://nodejs.org):
```bash
# Using nvm
nvm install 20
nvm use 20
```

### 2. Install pnpm

pnpm is the package manager for this repo (not npm, not yarn).

```bash
npm install -g pnpm
```

Verify:
```bash
pnpm --version   # should print 9.x or higher
```

> If your shell can't find `pnpm` after install, add npm's global bin to your PATH:
> ```bash
> export PATH="$PATH:$(npm root -g)/.bin"
> ```
> Add that line to your `~/.zshrc` or `~/.bashrc` to make it permanent.

### 3. Clone and install

```bash
git clone https://github.com/RishiSastry/aptlens.git
cd aptlens
pnpm install
```

`pnpm install` will automatically approve the required `esbuild` build scripts — this is already configured in `pnpm-workspace.yaml`, so no manual steps needed.

### 4. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

| Variable | Where to get it |
|---|---|
| `APIFY_TOKEN` | [apify.com](https://apify.com) → Settings → Integrations |
| `BOX_DEVELOPER_TOKEN` | [developer.box.com](https://developer.box.com) → My Apps → your app → Developer Token |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

Leave `USE_CACHED_APIFY=true` while developing — it prevents burning Apify credits.

### 5. Verify the setup

```bash
pnpm typecheck   # should print "3 successful"
pnpm dev:api     # starts API on http://localhost:8000
pnpm dev:web     # starts frontend on http://localhost:3000
```

---

## What this project is

AptLens is a pre-tour apartment due-diligence workflow. Given apartment URLs and user preferences it:

1. Crawls each property site (Apify)
2. Discovers units, floor plans, fees, pet policy, parking, and lease documents
3. Extracts structured facts per property and per unit
4. Judges and repairs extractions with LLM-as-judge loops
5. Filters and ranks units against user constraints
6. Analyzes floor plans with vision models
7. Generates a tour-ready decision packet
8. Saves all evidence and artifacts to Box

The user outcome is a ranked tour plan, not an apartment recommendation.

---

## Repo layout

```
aptlens/
  apps/
    web/                    React + Vite frontend
      src/
        App.tsx             Root component
        main.tsx            Entry point
        api/client.ts       fetch wrapper for /api/analyze
        components/         One file per UI component (see §UI Components)
        types/ui.ts         Frontend-only view types
    api/                    Hono server + LangGraph pipeline
      src/
        index.ts            Server entry (Hono, port 8000)
        routes/analyze.ts   POST /api/analyze handler
        graph/
          state.ts          AptLensAnnotation (LangGraph state)
          graph.ts          buildAptLensGraph() — all edges wired here
          nodes/            One file per graph node (~25 files)
        services/
          apify.ts          Apify client wrapper
          box.ts            Box SDK wrapper
          llm.ts            OpenAI/Anthropic wrapper + provider switch
          vision.ts         Vision model wrapper
        prompts/            Prompt templates as .md files
  packages/
    shared/
      src/
        types.ts            All shared TypeScript types
        schemas.ts          Zod schemas (analyzeRequestSchema, etc.)
        chartTypes.ts       ComparisonViews and chart datum types
        scoring.ts          computeOverallScore, weightsFromPreferences
        index.ts            Re-exports from types.ts
```

---

## How to build

```bash
# Install
pnpm install

# Dev (both apps)
pnpm dev

# Frontend only
pnpm dev:web   # http://localhost:3000

# Backend only
pnpm dev:api   # http://localhost:8000

# Type-check all packages
pnpm typecheck
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`, so the frontend can call `/api/analyze` directly without hardcoding the port.

---

## Environment setup

Copy `.env.example` to `.env` at the repo root and fill in keys.

During development set:
```
USE_CACHED_APIFY=true
```
This makes the `crawlUrls` node return locally cached JSON instead of burning Apify credits. Cache files live in `apps/api/src/fixtures/apify/`.

---

## Implementation order

Follow this order. Do not skip ahead.

### Step 1 — Shared types (done)
`packages/shared/src/types.ts`, `chartTypes.ts`, `schemas.ts`, `scoring.ts` are scaffolded. Add fields as needed; do not break existing exports.

### Step 2 — Mock backend response
In `apps/api/src/routes/analyze.ts`, return a hardcoded `AnalyzeResponse` with:
- 3–5 properties, 12–17 units, 5 ranked units
- tour plan, missing info, comparison views
This lets the frontend be built and tested without a live pipeline.

### Step 3 — Frontend dashboard
Build components in this order:
1. `IntakeForm` — URL list + preference inputs
2. `ProgressTimeline` — deterministic step list with check marks
3. `SummaryCards` — stats strip
4. `TourPlan` — tour first / ask before touring / skip sections
5. `RankedUnitsTable` — ranked unit rows with score columns
6. `ComparisonCharts` — ConstraintFit, CostBreakdown, EvidenceQuality (Recharts)
7. `ComparisonMatrix` — PetMatrix and FloorPlanMatrix tables
8. `MissingInfoPanel` — grouped by priority, copy-questions button
9. `EvidenceDrawer` — slide-out panel with source-grounded facts

### Step 4 — Backend graph skeleton
- Create `apps/api/src/graph/state.ts` (AptLensAnnotation)
- Create `apps/api/src/graph/graph.ts` (buildAptLensGraph with all nodes wired)
- Stub each node to return mock data matching the shared types
- Wire `POST /api/analyze` to run the graph and return a real `AnalyzeResponse`

### Step 5 — Scoring logic
Implement in pure TypeScript (no LLM):
- `filterUnitsByHardConstraints` — deterministic viability filter
- `triageRankUnits` — pre-vision score
- `computeFinalScores` — weighted overall score using `scoring.ts`
- `buildComparisonViews` — populate all six ComparisonViews arrays

### Step 6 — Apify integration
- Implement `apps/api/src/services/apify.ts`
- Implement the `crawlUrls` node
- Add `USE_CACHED_APIFY` fallback (cache path: `apps/api/src/fixtures/apify/<propertyId>.json`)

### Step 7 — Extraction prompts
- Write prompts in `apps/api/src/prompts/`
- Implement `extractPropertyFacts`, `extractUnitCandidates`
- Implement `judgeExtractions`, `repairOrMarkMissing`
- Max 2 judge/repair retries per `retryCounts` in state

### Step 8 — Floor-plan vision
- Implement `analyzeFloorplansWithVision` (OpenAI vision)
- Implement `judgeFloorplanAnalysis`, `repairFloorplanOrDowngradeConfidence`
- Implement `compareFloorplanComponents`

### Step 9 — Box integration
- Implement `apps/api/src/services/box.ts`
- Implement `createBoxProject`, `uploadArtifactsToBox`
- Folder structure: `/AptLens Projects/<projectId>/{raw-evidence,properties,units,reports,judge-results}`

### Step 10 — Polish
- Add sample URLs to the intake form
- Cache real crawl/extraction fixtures for demo fallback
- Final progress UI wiring

---

## Key conventions

### Never guess — always mark missing
When an LLM extraction node cannot find a value in the evidence, it must set `status: "missing"`, not invent a value. The `judgeExtractions` node will flag confirmed fields that lack a source URL or snippet.

### Separate property facts from unit facts
A property has one set of `PropertyFacts` (pet policy, parking, fees). Each unit has its own `UnitCandidate`. Do not copy property-level values into every unit.

### Judge loop max retries
Use `state.retryCounts[nodeName]` to track retries. Cap at 2. On max retries, mark remaining issues as `status: "unclear"` and continue.

### LLM provider switching
`TEXT_LLM_PROVIDER`, `VISION_LLM_PROVIDER`, `JUDGE_LLM_PROVIDER` in `.env` control which provider each service uses. The `apps/api/src/services/llm.ts` wrapper handles the switch. Do not hardcode `openai` or `anthropic` inside node files.

### Apify budget
- Max crawl depth: 2
- Max pages per property: 25
- Max total pages per run: 100
- Same-domain links only
- Exclude: login, apply, payment, resident-portal, blog, news, careers, gallery

### Box fallback
If Box API calls fail, log the error, continue without uploading, and leave `artifacts.boxProjectUrl` undefined. Never crash the pipeline on Box failure.

---

## API contract

**Request:** `POST /api/analyze`
```ts
{ urls: string[]; preferences: UserPreferences }
```

**Response:** `AnalyzeResponse` (see `packages/shared/src/types.ts`)

The full type definitions are the source of truth. Do not invent response fields; add them to `types.ts` first.

---

## UI component responsibilities

| Component | Tab | Purpose |
|---|---|---|
| `IntakeForm` | — | Collect URLs and preferences |
| `ProgressTimeline` | — | Show pipeline step status |
| `SummaryCards` | — | Stats strip (properties, units, floor plans, missing) |
| `TourPlan` | Tour Plan | Tour first / ask before / skip cards |
| `RankedUnitsTable` | Ranked Units | Sortable unit rows with score columns |
| `ComparisonCharts` | Comparison | ConstraintFit, CostBreakdown, EvidenceQuality charts |
| `ComparisonMatrix` | Comparison | Pet and floor-plan comparison tables |
| `InsightDrawer` | Ranked Units | Slide-out with per-unit breakdown |
| `EvidenceDrawer` | Evidence | Source-grounded fact list |
| `MissingInfoPanel` | Missing Info | Grouped by priority with copy button |

---

## Recharts chart data sources

| Chart | Data key |
|---|---|
| Constraint Fit | `comparisonViews.constraintFit` |
| Cost Breakdown | `comparisonViews.costBreakdown` |
| Evidence Quality | `comparisonViews.evidenceQuality` |
| Pet Matrix | `comparisonViews.petMatrix` |
| Floor Plan Matrix | `comparisonViews.floorPlanMatrix` |
| Tour Groups | `comparisonViews.propertyTourGroups` |

Do not derive chart data on the frontend. All chart-ready arrays come from the backend `buildComparisonViews` node.

---

## Do not build

- A general apartment search engine
- Real-time inventory sync
- Legal lease interpretation
- Neighborhood safety or demographic scoring
- Final apartment selection or recommendation ("choose this one")
- AWS integration (Box + Apify satisfies the hackathon sponsor requirement)
- Payment or application submission
