# AgroSmart Fase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the approved AgroSmart Fase 2 product: a Next.js dashboard backed by FastAPI image analysis, SQLite persistence, upload/dedup flows, LLM recommendations, PDF export, and Docker-based deployment.

**Architecture:** Keep the web app as the only SQLite writer, and keep the FastAPI service stateless except for writing annotated images to the shared `/data/uploads` volume. Build the project in vertical slices so each phase ends in something demoable: scaffold and schema first, then read-path dashboard, then analysis API, then upload flow, then resilience/observability, then LLM/reporting, then deployment polish.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui, Drizzle ORM, better-sqlite3, Bun, FastAPI, Python 3.12, OpenCV, Pillow, python-magic, Vercel AI SDK, OpenRouter, Caddy, Docker Compose.

---

## Planning assumptions

- This plan follows the approved design spec at `docs/superpowers/specs/2026-04-17-agrosmart-fase-2-design.md`.
- The approved scope explicitly excludes automated unit/E2E tests for MVP. Because of that, this plan uses **verification-first steps** (`lint`, typecheck, migrations, health checks, curl checks, smoke script, and manual route validation) instead of adding automated test suites.
- Keep all YAGNI boundaries from the spec: no auth, no multi-tenant, no CV pest classification, no dark mode, no Framer Motion.
- Prefer small commits after each task.
- Before implementation starts, mirror the exact directory tree described in the spec.

## Global execution checklist

Run these checks throughout the plan:

```bash
cd /Users/brunolago/Developer/fiap-eng/agrosmart-fase-2

# web checks
cd web && bun run lint && bun x tsc --noEmit && bun run build

# api checks
cd /Users/brunolago/Developer/fiap-eng/agrosmart-fase-2/api && python -m py_compile main.py analysis.py validation.py

# compose checks
cd /Users/brunolago/Developer/fiap-eng/agrosmart-fase-2 && docker compose -f docker-compose.yml -f docker-compose.dev.yml config >/dev/null
```

---

## Phase 1 — Scaffolding, environment, and data model

### Task 1: Create the web application skeleton

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/next.config.ts`
- Create: `web/biome.json`
- Create: `web/postcss.config.mjs`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/loading.tsx`
- Create: `web/src/app/globals.css`
- Create: `web/public/.gitkeep`

**Step 1: Write the minimal app and config files**

Create `web/package.json` with the required scripts:

```json
{
  "name": "agrosmart-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "bun run src/shared/db/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "seed": "bun run src/shared/db/seed.ts",
    "sweep:orphans": "bun run scripts/sweep-orphans.ts"
  }
}
```

Create `web/next.config.ts` with standalone output:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: [process.env.AGROSMART_PUBLIC_ORIGIN ?? "http://localhost:3000"],
    },
  },
};

export default nextConfig;
```

**Step 2: Install dependencies and verify the app boots**

Run:

```bash
cd web
bun install
bun run dev
```

Expected: Next.js starts on `http://localhost:3000` with a placeholder dashboard shell.

**Step 3: Add the root layout and placeholder home page**

Create `web/src/app/layout.tsx`:

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgroSmart Fase 2",
  description: "Plant health dashboard and analysis workflow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

**Step 4: Verify build output**

Run:

```bash
cd web
bun run build
```

Expected: production build succeeds and emits standalone output.

**Step 5: Commit**

```bash
git add web
git commit -m "chore: scaffold Next.js web app"
```

---

### Task 2: Add shared environment, ignore rules, and repository root files

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.gitattributes`
- Create: `README.md`
- Create: `LICENSE`
- Create: `data/.gitkeep`
- Create: `scripts/.gitkeep`

**Step 1: Add ignore rules for generated and runtime files**

Create `.gitignore`:

```gitignore
node_modules
.next
.env
.env.production
data/*
!data/.gitkeep
*.db
*.db-wal
*.db-shm
web/node_modules
web/.next
api/__pycache__
api/.venv
```

**Step 2: Add the environment contract**

Create `.env.example` with these keys:

```dotenv
DB_PATH=/data/agrosmart.db
UPLOADS_DIR=/data/uploads
API_BASE_URL=http://api:8000
OPENROUTER_API_KEY=your_openrouter_key_here
UPLOAD_AUDIT_SALT=replace_me
AGROSMART_DOMAIN=localhost
AGROSMART_PUBLIC_ORIGIN=http://localhost:3000
LLM_MAX_CALLS_PER_HOUR=20
SEED=2026
```

**Step 3: Verify the env file matches the spec**

Run:

```bash
rg "AGROSMART_PUBLIC_ORIGIN|OPENROUTER_API_KEY|UPLOAD_AUDIT_SALT|SEED" .env.example
```

Expected: all required variables are present exactly once.

**Step 4: Add a minimal README placeholder**

Create a short README with sections for setup, architecture, deployment, and known limitations. It will be completed in Phase 7.

**Step 5: Commit**

```bash
git add .gitignore .env.example .gitattributes README.md LICENSE data/.gitkeep scripts/.gitkeep
git commit -m "chore: add root project metadata and env contract"
```

---

### Task 3: Add the SQLite client, schema, and migration pipeline

**Files:**
- Create: `web/drizzle.config.ts`
- Create: `web/src/shared/db/client.ts`
- Create: `web/src/shared/db/schema.ts`
- Create: `web/src/shared/db/migrate.ts`
- Create: `web/drizzle/0000_init.sql`
- Create: `web/drizzle/meta/.gitkeep`

**Step 1: Define the SQLite client with mandatory PRAGMAs**

Create `web/src/shared/db/client.ts`:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(process.env.DB_PATH ?? "../data/agrosmart.db", {
  fileMustExist: false,
});

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("temp_store = MEMORY");
sqlite.pragma("mmap_size = 268435456");
sqlite.pragma("cache_size = -20000");

export const db = drizzle(sqlite);
export { sqlite };
```

**Step 2: Define the schema from the spec**

Create tables in `web/src/shared/db/schema.ts`:
- `farms`
- `fields`
- `analyses`
- `recommendations`
- `llm_cache`
- `uploads_audit`

Include these critical constraints:

```ts
requestId: text("request_id").notNull().unique(),
imageSha256: text("image_sha256").notNull().unique(),
fieldId: text("field_id").notNull().references(() => fields.id, { onDelete: "restrict" }),
analysisId: text("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
```

**Step 3: Write the initial migration script and SQL**

Add `web/src/shared/db/migrate.ts` using `drizzle-orm/better-sqlite3/migrator`.

Run:

```bash
cd web
bun run db:generate
bun run db:migrate
```

Expected: migration files exist and the SQLite database is created successfully.

**Step 4: Verify the schema manually**

Run:

```bash
sqlite3 ../data/agrosmart.db ".tables"
sqlite3 ../data/agrosmart.db "pragma foreign_keys;"
```

Expected: all tables exist and foreign keys are enabled.

**Step 5: Commit**

```bash
git add web/drizzle.config.ts web/src/shared/db web/drizzle
git commit -m "feat: add SQLite schema and migration pipeline"
```

---

### Task 4: Build deterministic seed data and local DB bootstrap

**Files:**
- Create: `web/src/shared/db/seed.ts`
- Create: `web/src/shared/db/queries/.gitkeep`
- Create: `web/scripts/.gitkeep`

**Step 1: Implement deterministic seed generation**

Create `web/src/shared/db/seed.ts` using `seedrandom`:

```ts
import seedrandom from "seedrandom";

const rng = seedrandom(process.env.SEED ?? "agrosmart-2026");
```

Seed:
- 2–3 farms
- multiple fields per farm
- 30 days of analyses
- deterministic `request_id`
- deterministic `image_sha256` like `seed:<farm>:<field>:<n>`
- `captured_at` relative to `now()` with seeded offsets

**Step 2: Run the seed script**

Run:

```bash
cd web
bun run seed
```

Expected: database contains deterministic sample data without duplicates.

**Step 3: Re-run seed to verify idempotency**

Run:

```bash
cd web
bun run seed
sqlite3 ../data/agrosmart.db "select count(*) from analyses;"
```

Expected: second seed run does not increase row count unexpectedly.

**Step 4: Verify data in Drizzle Studio**

Run:

```bash
cd web
bun run db:studio
```

Expected: tables are browsable and sample data looks realistic for charts.

**Step 5: Commit**

```bash
git add web/src/shared/db/seed.ts web/src/shared/db/queries/.gitkeep web/scripts/.gitkeep
git commit -m "feat: add deterministic seed data"
```

---

## Phase 2 — Dashboard read path

### Task 5: Build the application shell, layout primitives, and dashboard page structure

**Files:**
- Create: `web/src/shared/components/layout/app-shell.tsx`
- Create: `web/src/shared/components/layout/page-header.tsx`
- Create: `web/src/shared/components/ui/card.tsx`
- Create: `web/src/shared/components/ui/badge.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/loading.tsx`
- Create: `web/src/app/upload/page.tsx`
- Create: `web/src/app/analyses/[id]/page.tsx`
- Create: `web/src/app/report/page.tsx`
- Create: `web/src/app/admin/audit/page.tsx`

**Step 1: Create the route shells and placeholders**

Build the route tree first with placeholder text for:
- `/`
- `/upload`
- `/analyses/[id]`
- `/report`
- `/admin/audit`

**Step 2: Add route-level loading UI**

Create `web/src/app/loading.tsx` with skeleton cards so the dashboard never flashes blank.

**Step 3: Verify routing**

Run:

```bash
cd web
bun run dev
```

Open:
- `http://localhost:3000/`
- `http://localhost:3000/upload`
- `http://localhost:3000/report`
- `http://localhost:3000/admin/audit`

Expected: all routes render without runtime errors.

**Step 4: Verify production build still passes**

Run:

```bash
cd web
bun run build
```

Expected: routes compile successfully.

**Step 5: Commit**

```bash
git add web/src/app web/src/shared/components
git commit -m "feat: add dashboard route shells and layout primitives"
```

---

### Task 6: Add KPI queries and dashboard summary cards

**Files:**
- Create: `web/src/shared/db/queries/kpis.ts`
- Create: `web/src/features/kpis/server/get-kpis.ts`
- Create: `web/src/features/kpis/components/kpi-row.tsx`
- Modify: `web/src/app/page.tsx`

**Step 1: Write the aggregated KPI query**

Create a single query returning:
- total analyses
- healthy percentage
- diseased percentage
- pest types count

Use `unstable_cache` with `tags: ["analyses-kpi"]`.

**Step 2: Implement the KPI card renderer**

Render four cards with server-fetched data.

Use a small return shape like:

```ts
{
  total: number;
  healthyPct: number;
  diseasedPct: number;
  pestTypes: number;
}
```

**Step 3: Verify seeded values render**

Run:

```bash
cd web
bun run dev
```

Expected: home page shows real KPI numbers from SQLite, not placeholders.

**Step 4: Verify cache invalidation tags are present in code**

Run:

```bash
rg "analyses-kpi|unstable_cache" web/src
```

Expected: KPI query uses the approved cache tag.

**Step 5: Commit**

```bash
git add web/src/shared/db/queries/kpis.ts web/src/features/kpis web/src/app/page.tsx
git commit -m "feat: add dashboard KPI cards"
```

---

### Task 7: Add time-series aggregation and chart component

**Files:**
- Create: `web/src/shared/db/queries/time-series.ts`
- Create: `web/src/features/time-series/components/time-series-card.tsx`
- Create: `web/src/shared/components/charts/line-chart.tsx`
- Modify: `web/src/app/page.tsx`

**Step 1: Write the 30-day grouped query**

Group analyses by day and severity.

Return a shape like:

```ts
[{ date: "2026-04-01", healthy: 4, beginning: 2, diseased: 1 }]
```

**Step 2: Render the chart inside a Suspense boundary**

Use a client chart island fed by server data. Keep chart data fetch on the server.

**Step 3: Verify the chart renders from seeded data**

Run:

```bash
cd web
bun run dev
```

Expected: chart appears on the dashboard and reflects the last 30 days.

**Step 4: Verify no client-side re-fetching was introduced**

Run:

```bash
rg "fetch\(|useQuery|tanstack" web/src/features/time-series web/src/app/page.tsx
```

Expected: data comes from the RSC parent, not a client refetch.

**Step 5: Commit**

```bash
git add web/src/shared/db/queries/time-series.ts web/src/features/time-series web/src/shared/components/charts/line-chart.tsx web/src/app/page.tsx
git commit -m "feat: add 30-day severity chart"
```

---

### Task 8: Add pest breakdown, heatmap, and gallery read models

**Files:**
- Create: `web/src/shared/db/queries/heatmap.ts`
- Create: `web/src/shared/db/queries/gallery.ts`
- Create: `web/src/features/pest-breakdown/components/pest-breakdown-card.tsx`
- Create: `web/src/features/farm-heatmap/components/farm-heatmap-card.tsx`
- Create: `web/src/features/gallery/components/gallery-strip.tsx`
- Modify: `web/src/app/page.tsx`

**Step 1: Add the pest breakdown and heatmap queries**

The heatmap query must be one grouped query, not an N+1 loop.

Use the spec’s pattern:

```ts
.groupBy(farms.id, fields.id)
```

**Step 2: Add the gallery read model**

Create a query that returns the most recent uploaded analyses with thumbnail paths and annotated image references.

**Step 3: Render all three dashboard sections**

Use cards for:
- pest breakdown
- farm heatmap
- recent gallery strip

**Step 4: Verify the full read path**

Run:

```bash
cd web
bun run dev
```

Expected: dashboard shows KPI row, time series, pest breakdown, heatmap, and gallery placeholders populated from seeded data.

**Step 5: Commit**

```bash
git add web/src/shared/db/queries/heatmap.ts web/src/shared/db/queries/gallery.ts web/src/features/pest-breakdown web/src/features/farm-heatmap web/src/features/gallery web/src/app/page.tsx
git commit -m "feat: add dashboard read models and chart cards"
```

---

## Phase 3 — FastAPI analysis service

### Task 9: Scaffold FastAPI app, dependencies, health endpoint, and logging

**Files:**
- Create: `api/requirements.txt`
- Create: `api/main.py`
- Create: `api/logging_config.yaml`
- Create: `api/.dockerignore`

**Step 1: Create the Python dependency contract**

`api/requirements.txt` must include:
- `fastapi`
- `uvicorn`
- `opencv-python-headless`
- `pillow`
- `python-magic`
- `python-json-logger`
- `numpy`

**Step 2: Add a minimal FastAPI app and health route**

Create `api/main.py`:

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"ok": True, "version": "1.0.0"}
```

**Step 3: Verify the app boots locally**

Run:

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Expected: `GET /health` returns `{"ok":true,"version":"1.0.0"}`.

**Step 4: Verify Python files compile**

Run:

```bash
cd api
python -m py_compile main.py
```

Expected: no syntax errors.

**Step 5: Commit**

```bash
git add api/requirements.txt api/main.py api/logging_config.yaml api/.dockerignore
git commit -m "feat: scaffold FastAPI service"
```

---

### Task 10: Add image validation and hardened request parsing

**Files:**
- Create: `api/validation.py`
- Modify: `api/main.py`

**Step 1: Implement MIME, size, and image bomb validation**

Create `api/validation.py` with helpers for:
- content-type enforcement
- `python-magic` MIME sniffing
- `Image.verify()` and `Image.load()`
- 8 MiB limit
- 6000×6000 limit
- temporary file cleanup

Keep the allowed MIME list exact:

```python
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_BYTES = 8 * 1024 * 1024
MAX_DIMENSION = 6000
```

**Step 2: Add uniform error envelopes to the API**

Return:

```json
{
  "request_id": "...",
  "error": {
    "code": "INVALID_MIME",
    "message": "Short human message",
    "message_pt": "Mensagem curta para o usuário"
  }
}
```

**Step 3: Verify validation behavior with curl**

Run:

```bash
curl -i -X POST http://localhost:8000/analyze
```

Expected: 400 for missing fields.

Then run a wrong content-type request and confirm 415.

**Step 4: Verify Python syntax again**

Run:

```bash
cd api
python -m py_compile main.py validation.py
```

Expected: no syntax errors.

**Step 5: Commit**

```bash
git add api/validation.py api/main.py
git commit -m "feat: add hardened image validation"
```

---

### Task 11: Port the Phase 1 HSV analysis logic and annotated image generation

**Files:**
- Create: `api/analysis.py`
- Modify: `api/main.py`

**Step 1: Port the exact HSV thresholds and severity rules**

Create `api/analysis.py` with constants from the spec:

```python
LOWER_GREEN = np.array([35, 40, 40])
UPPER_GREEN = np.array([85, 255, 255])
LOWER_YELLOW = np.array([15, 40, 40])
UPPER_YELLOW = np.array([35, 255, 255])
LOWER_BROWN = np.array([5, 40, 30])
UPPER_BROWN = np.array([20, 255, 200])
KERNEL = np.ones((5, 5), np.uint8)
MIN_CONTOUR_AREA = 100
```

Implement:
- leaf detection
- diseased area detection
- bounding boxes
- severity classification
- annotated output file writing

**Step 2: Add the `NO_LEAF_DETECTED` warning path**

When `leaf_pixels == 0`, return 200 with:
- `severity = healthy`
- `affected_pct = 0`
- empty `bounding_boxes`
- `warnings = ["NO_LEAF_DETECTED"]`

**Step 3: Verify the endpoint with a real image**

Run:

```bash
curl -F "image=@/path/to/leaf.jpg" -F "request_id=$(uuidgen)" http://localhost:8000/analyze
```

Expected: 200 JSON with `severity`, `affected_pct`, `bounding_boxes`, and `processing_ms`.

**Step 4: Verify annotated file writing**

Run:

```bash
find ../data/uploads/annotated -type f | head
```

Expected: an annotated file exists after the request.

**Step 5: Commit**

```bash
git add api/analysis.py api/main.py
git commit -m "feat: port Phase 1 HSV analysis to FastAPI"
```

---

### Task 12: Containerize the API and make it compose-ready

**Files:**
- Create: `api/Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

**Step 1: Add the FastAPI Dockerfile**

Use the spec’s runtime shape:
- `python:3.12-slim`
- install `libgl1`, `libglib2.0-0`, `libmagic1`
- expose `8000`
- add healthcheck

**Step 2: Add compose services for `api` and a placeholder `web`**

The first compose version only needs enough config to boot `api` on the internal network and mount `/data`.

**Step 3: Verify the container boots**

Run:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up api --build
```

Expected: compose shows `api` healthy and `/health` responds.

**Step 4: Verify compose configuration**

Run:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config >/dev/null
```

Expected: config is valid.

**Step 5: Commit**

```bash
git add api/Dockerfile docker-compose.yml docker-compose.dev.yml
git commit -m "feat: containerize FastAPI service"
```

---

## Phase 4 — Upload flow, dedup, and image serving

### Task 13: Add upload domain types, hashing, file-safe helpers, and error copy

**Files:**
- Create: `web/src/shared/lib/errors.ts`
- Create: `web/src/shared/lib/error-copy-pt.ts`
- Create: `web/src/shared/lib/hash.ts`
- Create: `web/src/shared/lib/fs-safe.ts`
- Create: `web/src/shared/lib/env.ts`

**Step 1: Centralize action error codes**

Create `web/src/shared/lib/errors.ts` with the string union used in the spec.

**Step 2: Add pt-BR UI copy**

Create `web/src/shared/lib/error-copy-pt.ts` with the exact copy from the spec appendix.

**Step 3: Add SHA-256 hashing and safe file write helpers**

Implement:
- `sha256(buffer)`
- temp write + atomic rename
- path traversal guard
- disk space pre-check

**Step 4: Verify helper coverage**

Run:

```bash
rg "API_UNAVAILABLE|IMAGE_TOO_LARGE|INVALID_MIME|DISK_FULL" web/src/shared/lib
```

Expected: all action error codes and helpers are defined once.

**Step 5: Commit**

```bash
git add web/src/shared/lib/errors.ts web/src/shared/lib/error-copy-pt.ts web/src/shared/lib/hash.ts web/src/shared/lib/fs-safe.ts web/src/shared/lib/env.ts
git commit -m "feat: add upload helpers and error contracts"
```

---

### Task 14: Implement the upload Server Action with dedup and idempotency

**Files:**
- Create: `web/src/features/upload/actions/upload-image.ts`
- Modify: `web/src/shared/db/schema.ts`
- Modify: `web/src/shared/db/queries/gallery.ts`
- Modify: `web/src/app/upload/page.tsx`

**Step 1: Implement the Server Action contract**

The action must:
1. validate file size
2. compute SHA-256
3. check duplicate by `image_sha256`
4. persist original file atomically
5. call `POST /analyze`
6. persist row in SQLite with unique `request_id`
7. revalidate dashboard tags and paths

Use the result shape:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };
```

**Step 2: Add duplicate-return behavior**

If `image_sha256` already exists, do not call the API again. Return the existing analysis and show the duplicate toast.

**Step 3: Add tag invalidation**

Use:

```ts
revalidatePath("/");
revalidatePath("/upload");
revalidateTag("analyses-kpi");
revalidateTag("analyses-timeseries");
revalidateTag("analyses-gallery");
```

**Step 4: Verify the happy path and dedup path**

Run the app, upload the same file twice, and confirm:
- first upload inserts one row
- second upload returns existing result
- row count stays unchanged

**Step 5: Commit**

```bash
git add web/src/features/upload/actions/upload-image.ts web/src/shared/db/schema.ts web/src/shared/db/queries/gallery.ts web/src/app/upload/page.tsx
git commit -m "feat: add upload action with dedup and idempotency"
```

---

### Task 15: Build the upload UI with dropzone, pest selection, and pending states

**Files:**
- Create: `web/src/features/upload/components/upload-dropzone.tsx`
- Create: `web/src/features/upload/components/pest-type-select.tsx`
- Create: `web/src/features/upload/components/upload-result-card.tsx`
- Modify: `web/src/app/upload/page.tsx`

**Step 1: Build the client upload flow**

Use:
- `react-dropzone`
- `useTransition`
- disabled state while pending
- `aria-busy`
- pest dropdown required with default `nao_identificado`

**Step 2: Connect the UI to the Server Action**

Generate a `clientRequestId` in component state and submit it with the upload.

**Step 3: Render result feedback**

Show:
- severity label
- affected percentage
- duplicate notice when relevant
- link to detail page

**Step 4: Verify double-submit prevention**

Attempt rapid double-click/drop while pending.

Expected: only one active upload is processed.

**Step 5: Commit**

```bash
git add web/src/features/upload/components web/src/app/upload/page.tsx
git commit -m "feat: add upload dropzone and pest selector"
```

---

### Task 16: Add image serving, thumbnails, and analysis detail page

**Files:**
- Create: `web/src/app/api/images/[kind]/[hash]/route.ts`
- Create: `web/src/features/gallery/lib/image-paths.ts`
- Modify: `web/src/app/analyses/[id]/page.tsx`
- Modify: `web/src/features/gallery/components/gallery-strip.tsx`

**Step 1: Create the secured image route handler**

Validate:
- `kind` in `{original, annotated}`
- hash pattern
- path resolution inside `UPLOADS_DIR`

Return headers:

```ts
{
  "Cache-Control": "public, max-age=31536000, immutable",
  "ETag": `"sha256-${hash}"`,
}
```

**Step 2: Add thumbnail generation on upload**

Use `sharp` to create `data/uploads/thumbs/<hash>.webp`.

**Step 3: Render the detail page and gallery thumbnails**

Detail page should show:
- annotated image
- metadata
- severity
- pest type
- captured time

**Step 4: Verify image retrieval and traversal defense**

Run:

```bash
curl -I http://localhost:3000/api/images/annotated/<valid-hash>
curl -i http://localhost:3000/api/images/annotated/../../etc/passwd
```

Expected: valid hash returns 200, traversal attempt returns 400.

**Step 5: Commit**

```bash
git add web/src/app/api/images web/src/features/gallery/lib/image-paths.ts web/src/app/analyses/[id]/page.tsx web/src/features/gallery/components/gallery-strip.tsx
git commit -m "feat: add secured image serving and analysis detail page"
```

---

## Phase 5 — Observability, resilience, and audit trail

### Task 17: Add structured logging, request IDs, and lightweight metrics

**Files:**
- Create: `web/src/shared/lib/logger.ts`
- Create: `web/src/shared/lib/metrics.ts`
- Create: `web/src/app/api/health/route.ts`
- Create: `web/src/app/api/metrics/route.ts`
- Modify: `api/main.py`

**Step 1: Add `pino` logging in the web app**

Include fields:
- `requestId`
- `route`
- `durationMs`
- `event`
- `err.code`

**Step 2: Add request ID propagation to FastAPI**

Forward `X-Request-Id` from web to api and emit it in API logs.

**Step 3: Add the metrics endpoint**

Expose:
- uploads total
- uploads failed
- analyze latency p50/p95/p99
- llm latency p50/p95/p99
- circuit breaker state

**Step 4: Verify the endpoints**

Run:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/metrics
```

Expected: both return valid JSON.

**Step 5: Commit**

```bash
git add web/src/shared/lib/logger.ts web/src/shared/lib/metrics.ts web/src/app/api/health/route.ts web/src/app/api/metrics/route.ts api/main.py
git commit -m "feat: add structured logging and metrics endpoints"
```

---

### Task 18: Add rate limiting, circuit breaker, and resilient upload error handling

**Files:**
- Create: `web/src/shared/lib/rate-limit.ts`
- Create: `web/src/shared/lib/circuit-breaker.ts`
- Modify: `web/src/features/upload/actions/upload-image.ts`
- Modify: `web/src/features/upload/components/upload-dropzone.tsx`

**Step 1: Implement the in-memory circuit breaker**

States:
- `closed`
- `open`
- `half-open`

Threshold: 5 failures in 30 seconds opens for 60 seconds.

**Step 2: Add in-memory rate limiting**

Implement:
- 20 uploads/hour/IP
- 300 image fetches/hour/IP

Hash the IP with a daily salt.

**Step 3: Wire failure handling into the upload action**

Map network and API failures to the centralized error codes. Never expose raw server messages in UI.

**Step 4: Verify graceful degradation**

Stop the API container during an upload.

Expected:
- UI shows unavailable toast
- circuit opens after threshold
- subsequent calls fail fast while open

**Step 5: Commit**

```bash
git add web/src/shared/lib/rate-limit.ts web/src/shared/lib/circuit-breaker.ts web/src/features/upload/actions/upload-image.ts web/src/features/upload/components/upload-dropzone.tsx
git commit -m "feat: add upload resilience and rate limiting"
```

---

### Task 19: Add upload audit persistence and the public admin audit page

**Files:**
- Create: `web/src/shared/db/queries/audit.ts`
- Modify: `web/src/shared/db/schema.ts`
- Modify: `web/src/features/upload/actions/upload-image.ts`
- Modify: `web/src/app/admin/audit/page.tsx`

**Step 1: Persist audit rows for every upload attempt**

Store:
- request ID
- hashed IP
- hashed UA
- sha256
- bytes
- sniffed MIME
- result
- error code
- timestamp

**Step 2: Build the paginated audit query**

Limit to 100 rows per page. Do not expose raw IP or raw UA.

**Step 3: Render the admin page**

Show:
- request ID
- result status
- hashed identifiers
- mime
- created time
- error code if present

**Step 4: Verify privacy requirements**

Run:

```bash
sqlite3 ../data/agrosmart.db "select ip_hash, ua_hash from uploads_audit limit 3;"
```

Expected: stored values are hashes, not raw identifiers.

**Step 5: Commit**

```bash
git add web/src/shared/db/queries/audit.ts web/src/shared/db/schema.ts web/src/features/upload/actions/upload-image.ts web/src/app/admin/audit/page.tsx
git commit -m "feat: add public audit trail page"
```

---

## Phase 6 — LLM recommendations and PDF report

### Task 20: Add LLM prompts, client, cache table integration, and fallback copy

**Files:**
- Create: `web/src/shared/lib/llm/client.ts`
- Create: `web/src/shared/lib/llm/prompts.ts`
- Create: `web/src/shared/lib/llm/fallbacks.ts`
- Create: `web/src/shared/lib/llm/cache.ts`
- Modify: `web/src/shared/db/schema.ts`

**Step 1: Add the system prompt and compact summary contract**

Use the exact Portuguese system prompt from the spec and keep the summary JSON compact.

**Step 2: Add cache lookups with 6-hour TTL**

Cache key:

```ts
sha256(JSON.stringify(summaryInCanonicalOrder))
```

**Step 3: Add fallback recommendations by severity**

Create static copy for:
- healthy
- beginning
- diseased

**Step 4: Verify cache behavior**

Generate the same summary twice and confirm the second request is served from cache.

**Step 5: Commit**

```bash
git add web/src/shared/lib/llm web/src/shared/db/schema.ts
git commit -m "feat: add LLM cache and prompt layer"
```

---

### Task 21: Build the recommendation card with streaming and graceful fallback

**Files:**
- Create: `web/src/features/recommendations/actions/generate-recommendation.ts`
- Create: `web/src/features/recommendations/components/recommendation-card.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/shared/lib/metrics.ts`

**Step 1: Implement the recommendation action**

The action should:
- build the aggregated summary from DB queries
- check cache first
- enforce hourly call cap
- stream the provider response on miss
- fall back quietly on timeout, error, or 429

**Step 2: Add the recommendation card UI**

Show:
- skeleton while loading
- streamed text while receiving
- disclaimer below the card
- fallback chip when offline/defaulted

**Step 3: Wire the card into the dashboard**

Place it below the KPI row and above lower-priority sections or where it best fits the existing layout.

**Step 4: Verify both success and fallback paths**

Test:
- valid API key => streamed response
- invalid or missing API key => static fallback with chip

**Step 5: Commit**

```bash
git add web/src/features/recommendations web/src/app/page.tsx web/src/shared/lib/metrics.ts
git commit -m "feat: add streaming recommendation card"
```

---

### Task 22: Build the report page and PDF export flow

**Files:**
- Create: `web/src/features/report/components/report-view.tsx`
- Create: `web/src/features/report/lib/report-data.ts`
- Modify: `web/src/app/report/page.tsx`

**Step 1: Aggregate the report data**

Include:
- main KPI summary
- primary chart snapshot data
- current recommendation text
- timestamp

**Step 2: Implement the export view**

Use `react-pdf` or the chosen PDF renderer from the approved stack.

**Step 3: Render the report page**

Expose a user path to generate/download the PDF.

**Step 4: Verify PDF output manually**

Open `/report`, generate the PDF, and confirm the file downloads and contains the expected sections.

**Step 5: Commit**

```bash
git add web/src/features/report web/src/app/report/page.tsx
git commit -m "feat: add report page and PDF export"
```

---

## Phase 7 — Deployment, ops scripts, and documentation polish

### Task 23: Finalize multi-stage Dockerfiles, compose files, and Caddy configuration

**Files:**
- Create: `web/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.dev.yml`
- Create: `docker-compose.prod.yml`
- Create: `Caddyfile`

**Step 1: Add the multi-stage web Dockerfile**

Use:
- Bun base image
- standalone Next output
- non-root runtime user
- `/api/health` healthcheck

**Step 2: Expand compose to the final topology**

Compose must include:
- `web`
- `api`
- `caddy`
- shared `data` volume
- internal and public networks

**Step 3: Add hardened Caddy headers**

Include:
- HSTS
- `X-Content-Type-Options nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- CSP from the spec

**Step 4: Verify end-to-end compose config**

Run:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Expected: web, api, and proxy become healthy and the app is reachable end-to-end.

**Step 5: Commit**

```bash
git add web/Dockerfile docker-compose.yml docker-compose.dev.yml docker-compose.prod.yml Caddyfile
git commit -m "feat: finalize container and proxy deployment stack"
```

---

### Task 24: Add smoke test fixtures, orphan sweeper, and runbook

**Files:**
- Create: `scripts/smoke.sh`
- Create: `scripts/fixtures/healthy-leaf.jpg`
- Create: `scripts/fixtures/diseased-leaf.jpg`
- Create: `web/scripts/sweep-orphans.ts`
- Create: `docs/runbook.md`

**Step 1: Implement orphan sweep logic**

The script must report:
- files without DB rows
- DB rows without files

It should log, not auto-delete, per the spec.

**Step 2: Implement the smoke script**

The script must:
1. curl web and api health endpoints
2. post a fixture image
3. assert HTTP 200 and `severity` in JSON
4. clean up dev test artifacts
5. exit non-zero on failure

**Step 3: Add the runbook**

Document:
- deploy flow
- backup command
- restore notes
- smoke command
- seed workflow

**Step 4: Verify the ops tools**

Run:

```bash
./scripts/smoke.sh
cd web && bun run sweep:orphans
```

Expected: smoke passes and orphan sweep prints a clean report or actionable issues.

**Step 5: Commit**

```bash
git add scripts/smoke.sh scripts/fixtures web/scripts/sweep-orphans.ts docs/runbook.md
git commit -m "feat: add smoke test and runbook"
```

---

### Task 25: Finish README, robots policy, and known limitations documentation

**Files:**
- Modify: `README.md`
- Create: `web/src/app/robots.ts`
- Optionally create: `docs/architecture.md`

**Step 1: Expand the README**

Include:
- architecture overview
- local setup
- Docker commands
- deploy commands
- known limitations
- explicit note about MVP coupling via shared upload volume
- public `/admin/audit` trade-off note

**Step 2: Add robots policy**

Disallow `/admin/` and add noindex behavior where relevant.

**Step 3: Verify docs are aligned with implementation**

Run:

```bash
rg "Known limitations|/admin/audit|shared volume|OpenRouter" README.md docs/runbook.md
```

Expected: docs mention the agreed trade-offs and deployment flow.

**Step 4: Final docs sanity check**

Read the README from top to bottom and verify every command exists in code/config.

**Step 5: Commit**

```bash
git add README.md web/src/app/robots.ts docs/architecture.md
git commit -m "docs: finalize README and deployment notes"
```

---

## Phase 8 — Final verification and demo prep

### Task 26: Run end-to-end verification and prepare the demo checklist

**Files:**
- Create: `docs/demo-checklist.md`
- Optionally modify: `README.md`

**Step 1: Run full local verification**

Run:

```bash
cd /Users/brunolago/Developer/fiap-eng/agrosmart-fase-2

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api
cd web && bun install && bun run db:migrate && bun run seed && bun run lint && bun x tsc --noEmit && bun run build
cd /Users/brunolago/Developer/fiap-eng/agrosmart-fase-2 && ./scripts/smoke.sh
```

Expected: all verification commands succeed.

**Step 2: Run manual product verification**

Verify manually:
- dashboard loads with seeded data
- upload works
- duplicate upload reuses existing analysis
- detail page shows annotated image
- recommendation card streams or falls back correctly
- report downloads
- admin audit renders hashed data
- metrics endpoint returns JSON

**Step 3: Write the demo checklist**

Create a short operator script for the recording:
1. show dashboard
2. upload healthy image
3. upload diseased image
4. open detail page
5. show recommendation
6. generate report
7. show audit and metrics

**Step 4: Final build freeze commit**

```bash
git add docs/demo-checklist.md README.md
git commit -m "chore: add final demo verification checklist"
```

**Step 5: Release handoff**

Record the exact commands and URLs needed for the FIAP presentation in the checklist.

---

## Suggested implementation order inside execution sessions

1. Phase 1 completely
2. Phase 2 completely
3. Phase 3 completely
4. Phase 4 completely
5. Phase 5 completely
6. Phase 6 completely
7. Phase 7 completely
8. Phase 8 verification only after all features are in place

## Non-negotiable guardrails during execution

- Do not add auth.
- Do not add automated test suites unless the scope changes explicitly.
- Do not let FastAPI write to SQLite.
- Do not return raw annotated image bytes from the API.
- Do not bypass MIME sniffing.
- Do not bypass SHA-256 dedup.
- Do not expose raw IP or UA anywhere.
- Do not serve upload files directly without path validation.
- Do not move beyond the approved stack without a spec change.

## Definition of done

The project is done when all of the following are true:
- seeded dashboard renders with all core visualizations
- FastAPI `/analyze` works with real image uploads
- uploads are deduplicated by SHA-256
- original, thumbnail, and annotated images are stored and retrievable safely
- audit trail records uploads with hashed identifiers
- metrics and health endpoints are available
- recommendation card uses cache, streams on success, and falls back safely on failure
- report page exports a PDF
- Docker Compose boots the full stack
- Caddy fronts the app with the hardened headers from the spec
- smoke script passes locally and on the target VPS
- README and runbook document setup, deployment, backup, and known limitations
