---
project: agrosmart-fase-2
type: design-spec
updated: 2026-04-17
status: approved-for-planning
authors: software-architect
---

# AgroSmart Fase 2 — Hardened Production-Grade Design Spec

> **Status**: Ready for plan-writer consumption. Ambiguous points flagged in §15.
> **Scope guard**: No auth, no multi-tenant, no CV pest classification, no automated tests, no dark mode, no framer motion. All YAGNI boundaries from the approved design remain intact.

---

## 0. System diagram (text)

```
                      ┌─────────────────────────────────┐
                      │  Caddy (TLS, HSTS, gzip, rate)  │
                      │          Port 443/80            │
                      └──────────────┬──────────────────┘
                                     │ reverse_proxy
                       ┌─────────────▼─────────────┐
                       │  Next.js 16 (web)         │
                       │  RSC + Server Actions     │
                       │  :3000 (internal)         │
                       └───┬───────────┬───────────┘
          better-sqlite3  │           │ fetch (http, docker net)
                          ▼           ▼
                 ┌─────────────┐  ┌─────────────────────┐
                 │ SQLite WAL  │  │ FastAPI (api)       │
                 │ /data/db    │  │ OpenCV + Pillow     │
                 │             │  │ :8000 (internal)    │
                 └─────────────┘  └─────────────────────┘
                          │
                          ▼
                 ┌─────────────────┐       ┌──────────────────────┐
                 │ /data/uploads/  │       │ OpenRouter (egress)  │
                 │   (volume)      │       │ Gemini 2.5 Flash Lite│
                 └─────────────────┘       └──────────────────────┘

 Egress only: web → OpenRouter. api has NO egress. Caddy is the only ingress.
```

Trust boundaries: `Caddy` (untrusted public) → `web` (semi-trusted, validates all input) → `api` and `sqlite` (trusted internals, docker-network only). LLM provider is external trust boundary; responses treated as untrusted text.

---

## 1. API contract specification (`POST /analyze`)

### 1.1 Request

- **Method / path**: `POST /analyze`
- **Content-Type**: `multipart/form-data` only. Reject `application/json` with `415`.
- **Fields**:
  - `image` (required, file) — single image file.
  - `request_id` (required, string, UUIDv4) — supplied by web, echoed back for correlation.
- **Limits** (enforced in FastAPI with a middleware and in Next.js Server Action before forwarding):
  - Max file size: **8 MiB**. Web checks via `File.size`, API enforces via `Content-Length` + streaming cutoff.
  - Max decoded dimensions: **6000×6000 px**. Reject larger before OpenCV (Pillow `Image.open` with `MAX_IMAGE_PIXELS` guard) to stop decompression bombs.
  - Accepted MIME (sniffed, not just extension): `image/jpeg`, `image/png`, `image/webp`, `image/bmp`. Use `python-magic` (libmagic) for sniffing; do not trust the client-provided type.

### 1.2 Response (200 OK)

```json
{
  "request_id": "c3b1d2e5-...-...",
  "severity": "healthy | beginning | diseased",
  "severity_label_pt": "Planta saudável | Possível início de doença | Planta doente",
  "affected_pct": 12.47,
  "leaf_pixels": 238491,
  "diseased_pixels": 29742,
  "bounding_boxes": [
    { "x": 120, "y": 44, "w": 80, "h": 60, "area_px": 4800 }
  ],
  "processing_ms": 312,
  "api_version": "1.0.0"
}
```

### 1.3 Error shape (4xx / 5xx)

Uniform envelope:

```json
{
  "request_id": "c3b1d2e5-...",
  "error": {
    "code": "INVALID_MIME | IMAGE_TOO_LARGE | DECODE_FAILED | NO_LEAF_DETECTED | INTERNAL",
    "message": "Short human message (en)",
    "message_pt": "Mensagem curta para o usuário (pt-BR)"
  }
}
```

Web **never** surfaces the raw API error to UI — it translates `code` to a `pt-BR` toast string via a constant map. `message_pt` exists as a fallback only.

### 1.4 Status code policy

| Condition | Code |
|---|---|
| OK | 200 |
| Missing `image` or `request_id` | 400 `MISSING_FIELD` |
| Wrong Content-Type | 415 `INVALID_MIME` |
| MIME sniff mismatch | 415 `INVALID_MIME` |
| File > 8 MiB | 413 `IMAGE_TOO_LARGE` |
| Dimension > 6000 or decompression bomb | 413 `IMAGE_TOO_LARGE` |
| Pillow/OpenCV cannot decode | 422 `DECODE_FAILED` |
| `area_folha == 0` (no leaf pixels) | 200 with `severity: "healthy"`, `affected_pct: 0`, `bounding_boxes: []`, but add `warnings: ["NO_LEAF_DETECTED"]` so dashboard can flag. Do **not** 422 — the image was valid, just unhelpful. |
| Unhandled exception | 500 `INTERNAL` |

### 1.5 Timeout budgets

- Next.js Server Action → `fetch(api)`: **AbortController timeout 15 s**.
- FastAPI per-request: uvicorn default no timeout; add `asgi-correlation-id` + explicit `asyncio.wait_for(analysis, timeout=10)` inside the handler. OpenCV runs sync — wrap in `run_in_threadpool` with the wait.
- Caddy `reverse_proxy` transport: `read_timeout 20s`, `write_timeout 20s`.
- Total user-perceived budget: **20 s**. Past that, web shows "A análise está demorando mais que o esperado" and offers retry.

### 1.6 Malformed image handling

1. Save incoming bytes to a temp path (`tempfile.NamedTemporaryFile`).
2. `file_type = magic.from_buffer(head_bytes, mime=True)` — must be in whitelist.
3. `Image.open(path).verify()` (Pillow) — catches truncated files and bombs.
4. Second `Image.open(path).load()` (verify doesn't actually load; load does).
5. Re-read via `cv2.imread` only after passing 1–4. If any step fails → `422 DECODE_FAILED`.
6. Always clean temp file in `finally`.

### 1.7 Analysis logic (ported from Phase 1)

Keep HSV ranges, morphology kernel, and severity thresholds byte-identical to `agrosmart-fase-1/analise_plantas.py` so academic continuity holds. Move functions into `api/analysis.py`:

```python
# api/analysis.py
LOWER_GREEN = np.array([35, 40, 40]); UPPER_GREEN = np.array([85, 255, 255])
LOWER_YELLOW = np.array([15, 40, 40]); UPPER_YELLOW = np.array([35, 255, 255])
LOWER_BROWN = np.array([5, 40, 30]); UPPER_BROWN = np.array([20, 255, 200])
KERNEL = np.ones((5, 5), np.uint8)
MIN_CONTOUR_AREA = 100

def classify(pct: float) -> Literal["healthy","beginning","diseased"]:
    if pct < 5: return "healthy"
    if pct < 15: return "beginning"
    return "diseased"
```

The **annotated image** (red bounding boxes) produced by Phase 1 is **not** returned in the response body — too heavy. Instead, api writes `annotated_<uuid>.jpg` into the shared `uploads/` volume and returns `annotated_path` as a relative path. Web serves it via its own handler (see §4.5).

---

## 2. Idempotency & deduplication

### 2.1 Content-hash dedup

- On upload, web computes **SHA-256** of the file bytes *before* forwarding to api.
- `analyses` table has a **unique constraint on `image_sha256`** (partial: only where `source='upload'`). SQLite doesn't support partial unique indexes on NULL well, so use a non-null `image_sha256 TEXT NOT NULL` column, with seed rows using deterministic synthetic hashes (`'seed:' || id` or similar).
- On duplicate: **return the existing analysis**, do not call api again, do not rewrite the file. Toast: "Esta imagem já foi analisada em {captured_at}." + link to the existing result.
- Rationale: cheap idempotency, lets users re-drop the same image without creating clutter.

### 2.2 Server Action idempotency key

Every upload submission carries a client-generated `clientRequestId` (UUIDv4) stored in component state. The Server Action uses it as the row's `request_id` column with a unique constraint. If the action retries (double-submit, React double-invocation in dev), the second call hits the unique constraint, the server detects the conflict, and returns the *same* result as the first call. Idempotency is thus enforced by DB, not by an in-memory map.

```ts
// shared/db/schema.ts snippet
analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(), // uuid
  requestId: text("request_id").notNull().unique(),
  imageSha256: text("image_sha256").notNull().unique(),
  // ...
});
```

### 2.3 Dropzone double-submit prevention

- `useTransition` flag: disable the dropzone while `isPending`.
- `react-dropzone` with `disabled={isPending}` + visual "Analisando..." state.
- Debounce is *not* the right tool here (single event); disabling the input is.
- Additionally: `upload-button` has `aria-busy={isPending}` and `type="button"` to avoid accidental form submit.

---

## 3. Race conditions & concurrency

### 3.1 SQLite configuration (mandatory)

Apply at better-sqlite3 client construction time:

```ts
// shared/db/client.ts
import Database from "better-sqlite3";
const sqlite = new Database(env.DB_PATH, { fileMustExist: false });
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("temp_store = MEMORY");
sqlite.pragma("mmap_size = 268435456"); // 256 MiB
sqlite.pragma("cache_size = -20000"); // 20 MiB
```

- `journal_mode=WAL`: concurrent readers don't block the writer.
- `synchronous=NORMAL`: fine with WAL; `FULL` is overkill here.
- `busy_timeout=5000`: give writes a 5 s window to resolve contention before throwing `SQLITE_BUSY`.
- `foreign_keys=ON`: default is OFF in SQLite — explicit.

### 3.2 Writer serialization

Only **one process** ever writes — the Next.js server. FastAPI never touches SQLite. This eliminates cross-process writer contention; we only face intra-process concurrency from Server Actions. Node is single-threaded in its event loop, and better-sqlite3 is **synchronous** — writes cannot interleave mid-transaction. This is a feature here.

### 3.3 Upload during seed

Seed script is a **one-shot CLI** (`bun run seed`) that acquires a file lock (`flock` via `proper-lockfile` on `data/.seed.lock`) and refuses to run if the web server is up and serving. Runbook: seed is done once, offline, before first deploy. If users upload during re-seed (edge case), seed uses `INSERT OR IGNORE` on a deterministic `request_id` so reruns are idempotent.

### 3.4 RSC cache invalidation

After any upload succeeds, the Server Action calls:

```ts
revalidatePath("/");           // dashboard
revalidatePath("/upload");     // reflects last upload in gallery strip
revalidateTag("analyses-kpi"); // KPI fetches tagged
revalidateTag("analyses-timeseries");
revalidateTag("analyses-gallery");
```

All dashboard queries use `unstable_cache` with those tags:

```ts
const getKpis = unstable_cache(
  async () => db.select()...,
  ["kpis"],
  { tags: ["analyses-kpi"], revalidate: 60 }
);
```

`revalidate: 60` is a **safety net** for stale-after-crash scenarios; tag invalidation is the primary path.

### 3.5 Stale read during write

Not a real problem because:
- Writes are single-process.
- SQLite WAL means readers see a consistent snapshot (MVCC-ish).
- RSC renders are per-request, so the "stale read" window is the request duration itself, which is fine.

---

## 4. Filesystem edge cases

### 4.1 Image storage naming

**Winner: content hash** (`sha256.jpg`). Reasons:
- Natural dedup — two identical uploads write to the same path, no collision handling needed.
- Makes §2.1 trivial.
- Seed files use `seed_<field_id>_<n>.jpg` prefix to distinguish from uploads.

Layout:
```
data/uploads/
├── original/
│   ├── 3f4a...e2.jpg
│   └── seed_farm-a_0001.jpg
└── annotated/
    ├── 3f4a...e2.jpg
    └── seed_farm-a_0001.jpg
```

Extension is preserved from the sniffed MIME, not from the filename the client sent.

### 4.2 Orphan prevention

Order of operations on upload:
1. Compute hash.
2. `SELECT` existing row by hash — if found, return it (no file write, no api call).
3. Write original bytes to `data/uploads/original/<hash>.<ext>` **atomically**: write to `.tmp` then `fs.rename` (POSIX atomic within same filesystem).
4. Call api; api writes annotated file.
5. `INSERT` row inside a transaction. On failure: unlink both files.

Nightly orphan sweeper: a `bun run sweep:orphans` CLI script that finds files in `uploads/` without a matching DB row (and rows without files) and logs them. **Not scheduled automatically** — manual tool for demo maintenance (YAGNI on cron).

### 4.3 Disk full

- `statvfs` check at upload action entry point: if free space < 500 MB, reject with `DISK_FULL` error code → toast "Espaço em disco insuficiente no servidor, tente novamente mais tarde."
- Caddy has `max_request_body 10MB` as defense in depth.

### 4.4 Path traversal

- Image retrieval endpoint: `GET /api/images/:kind/:hash` where `:kind ∈ {original, annotated}` and `:hash` is validated against `^[a-f0-9]{64}$` (or the seed prefix pattern). Anything else → 400.
- Server constructs the path as `path.join(UPLOADS_DIR, kind, `${hash}.jpg`)` then calls `path.resolve` and asserts the resolved path starts with `UPLOADS_DIR`. This blocks `..` escapes even if the regex were bypassed.

### 4.5 Serving strategy

- **Not** `next/image` for uploads — would need to whitelist a loader and it's a runtime image.
- Custom route handler `app/api/images/[kind]/[hash]/route.ts`:
  - `Cache-Control: public, max-age=31536000, immutable` (content-addressed, safe).
  - `ETag: "sha256-<hash>"` (trivial because the filename IS the hash).
  - Streams via `fs.createReadStream`.
  - `Content-Type` from sniffed value stored at write time (not from extension).
- Thumbnails: generated **on upload** via `sharp` in the web container at `data/uploads/thumbs/<hash>.webp` (max 320×320). `sharp` is Node-native, no extra service. Gallery requests thumbs; detail page gets annotated original.

---

## 5. Error handling policy

### 5.1 Result pattern alignment

All Server Actions return:

```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ActionErrorCode; message: string } };
```

`ActionErrorCode` is a string-literal union centralized in `shared/lib/errors.ts`. UI renders via `ERROR_COPY_PT[code]` map — never interpolates server text.

### 5.2 Specific failure modes

| Failure | User sees | Log level | Recovery |
|---|---|---|---|
| FastAPI unreachable (connect refused) | Toast: "Serviço de análise indisponível. Tente em alguns instantes." + retry button | `error` | Circuit breaker (see below) |
| FastAPI 5xx | Same toast | `error` | Client retries once automatically with backoff |
| FastAPI 4xx (validation) | Code-specific toast (file too big, wrong format, etc.) | `warn` | No retry |
| Analysis timeout | "A análise demorou demais. Tente novamente com uma imagem menor." | `warn` | Manual retry |
| Corrupted image | "Não foi possível decodificar a imagem." | `warn` | No retry |
| LLM failure | Recommendation card shows **static fallback** (pre-written generic recommendation by severity) + small "gerado offline" chip | `warn` | Background retry on next request |
| LLM rate limit (429) | Same fallback + "Limite de IA atingido, usando sugestão padrão." chip | `warn` | Wait for next cache window |
| LLM timeout (> 8 s) | Fallback | `warn` | — |
| DB write conflict (SQLITE_BUSY after 5 s) | "Servidor ocupado, tente novamente." | `error` | Manual retry |
| Disk full | "Espaço insuficiente no servidor." | `error` | Ops-only |

### 5.3 Circuit breaker for api

Simple in-memory, single-process breaker in `shared/lib/circuit-breaker.ts`:
- States: `closed`, `open`, `half-open`.
- Thresholds: 5 failures / 30 s window → `open` for 60 s.
- While open, Server Action returns `API_UNAVAILABLE` immediately without calling.
- Stored in module scope; acceptable because web runs single process.

---

## 6. Observability

### 6.1 Logging

- **pino** in web (JSON structured). `pino-pretty` only in dev via `NODE_ENV` check.
- Every HTTP request gets a `requestId` (nanoid, 12 chars). Propagated to api via `X-Request-Id` header; FastAPI picks it up and includes in its log line.
- Log fields: `ts`, `level`, `requestId`, `route`, `durationMs`, `event`, `err.code`, `err.msg`.
- **Never log**: image bytes, raw LLM prompts with user data (log prompt *hash* instead), full stack traces at `info` (only at `error`).
- Retention: file rotation via `pino.destination` with `pino-roll` — 7 days, 100 MB per file. Lives in `data/logs/`.

### 6.2 FastAPI logging

- `uvicorn --log-config log_config.yaml` with JSON formatter (`python-json-logger`).
- Fields: `ts`, `level`, `request_id`, `event`, `duration_ms`, `status`, `err_code`.

### 6.3 Metrics (lightweight)

- In `shared/lib/metrics.ts`: an in-memory sliding-window counter + histogram (reservoir of last 1000 samples per metric). Exposed at `GET /api/metrics` (no auth, public demo) as JSON:

```json
{
  "uploads_total": 42,
  "uploads_failed": 2,
  "analyze_latency_ms": { "p50": 220, "p95": 680, "p99": 1100 },
  "llm_latency_ms": { "p50": 900, "p95": 3200, "p99": 7800 },
  "circuit_breaker": "closed"
}
```

Prometheus / OTel would be over-engineering for this scope. The endpoint itself is the demo.

### 6.4 Error tracking

Console + pino logs only. Sentry is deferred to a "// TODO post-MVP" comment with the exact integration point marked.

### 6.5 Audit trail

Every upload writes a row to `uploads_audit`:

```sql
uploads_audit (
  id, request_id, ip_hash, ua_hash, sha256, bytes, sniffed_mime,
  result: 'analyzed' | 'duplicate' | 'rejected',
  error_code, created_at
)
```

- IP and UA are **hashed** (`sha256(value + SALT)`) to preserve privacy. Salt from env.
- Visible at `/admin/audit` — no auth, trusts the VPS is firewall-locked; acceptable for demo. Document this in README.

---

## 7. Security

### 7.1 CSRF

Next.js Server Actions have built-in Origin validation in Next 14+, confirmed in Next 16. Nothing extra needed for state-changing actions invoked from same-origin pages. Verify `allowedOrigins` via `next.config.ts` `experimental.serverActions.allowedOrigins` matches `AGROSMART_PUBLIC_ORIGIN`.

### 7.2 Upload hardening

- Extension whitelist AND MIME sniff (§1.1/§1.6).
- Strip EXIF on save: `sharp(buffer).rotate().toFile(...)` — `.rotate()` without args applies EXIF orientation then discards it. Prevents EXIF-based privacy leaks (GPS).
- No SVG (avoid XSS via inline scripts).
- No TIFF (larger decompression bomb surface, not in whitelist anyway).

### 7.3 Rate limiting

Per-IP token bucket on `POST /upload` Server Action and on `GET /api/images/*`:
- 20 uploads / hour / IP.
- 300 image fetches / hour / IP.

Implementation: `rate-limiter-flexible` with memory store (single-process; fine). Key = sha256(IP + daily salt). Reject with 429 + `Retry-After`.

### 7.4 Network isolation

- `docker-compose.yml` puts `api` on an internal network **only**. No published port.
- `web` joins both the internal network (to reach api) and a public-ish network that Caddy proxies into.
- Caddy binds 80/443 only.

### 7.5 Caddy headers

```Caddyfile
{$AGROSMART_DOMAIN} {
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), camera=(), microphone=()"
        Content-Security-Policy "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
        -Server
    }
    reverse_proxy web:3000 {
        transport http {
            read_timeout 20s
            write_timeout 20s
        }
    }
}
```

CSP uses `'unsafe-inline'` for script because Next.js inline bootstrap requires it; nonce-based CSP is a post-MVP hardening task.

### 7.6 Secrets

- `.env.example` committed with placeholder values and inline comments.
- `.env` in `.gitignore`.
- Production: env vars injected via docker-compose `env_file: .env.production` (not committed).
- Secrets used: `OPENROUTER_API_KEY`, `UPLOAD_AUDIT_SALT`, `AGROSMART_DOMAIN`, `AGROSMART_PUBLIC_ORIGIN`.

---

## 8. Performance

### 8.1 Indexes

```ts
// drizzle migration
index("analyses_field_captured_idx").on(analyses.fieldId, analyses.capturedAt.desc()),
index("analyses_captured_idx").on(analyses.capturedAt.desc()),
index("analyses_severity_idx").on(analyses.severity),
index("analyses_pest_captured_idx").on(analyses.pestType, analyses.capturedAt.desc()),
uniqueIndex("analyses_sha_idx").on(analyses.imageSha256),
uniqueIndex("analyses_request_idx").on(analyses.requestId),
index("fields_farm_idx").on(fields.farmId),
index("recommendations_analysis_idx").on(recommendations.analysisId),
```

Rationale:
- KPI + time series queries filter by `captured_at` range.
- Heatmap groups by `field_id` → `(field_id, captured_at)` composite covers both access patterns.
- Pest breakdown uses `(pest_type, captured_at)`.

### 8.2 N+1 avoidance

Heatmap (the riskiest query) uses a single aggregated query:

```ts
const heatmap = await db
  .select({
    farmId: farms.id,
    farmName: farms.name,
    fieldId: fields.id,
    fieldName: fields.name,
    avgAffected: sql<number>`avg(${analyses.affectedPct})`.as("avg_affected"),
    sampleCount: sql<number>`count(${analyses.id})`.as("sample_count"),
  })
  .from(fields)
  .innerJoin(farms, eq(fields.farmId, farms.id))
  .leftJoin(
    analyses,
    and(
      eq(analyses.fieldId, fields.id),
      gte(analyses.capturedAt, since),
    ),
  )
  .groupBy(farms.id, fields.id);
```

One query, grouped, bounded by date. No loop of per-field queries.

### 8.3 Thumbnails

- Generated synchronously on upload via `sharp` in web (fast; typical <100 ms).
- Seed script generates them too during seeding.
- Gallery renders `<img loading="lazy">` + `srcset` only if we add more sizes later (MVP: single 320×320 webp).

### 8.4 RSC streaming

- Dashboard `page.tsx` uses `<Suspense>` per card:
  ```tsx
  <Suspense fallback={<KpiSkeleton />}><KpiRow /></Suspense>
  <Suspense fallback={<ChartSkeleton />}><TimeSeriesCard /></Suspense>
  ```
- Each card fetches independently. Slow cards (LLM-backed recommendation, farm heatmap) don't block above-the-fold KPIs.
- `loading.tsx` for route-level fallback.

### 8.5 Recharts hydration cost

- All charts are `"use client"` islands imported dynamically with `next/dynamic` + `{ ssr: false }` only where chart computes on client data; otherwise server-render the data, pass to client chart.
- Avoid re-fetching on client — data flows from RSC parent to client chart component as props.

---

## 9. Data integrity

### 9.1 Foreign keys & cascade

```ts
farms: {
  id: text("id").primaryKey(),
}
fields: {
  farmId: text("farm_id").notNull().references(() => farms.id, { onDelete: "restrict" }),
}
analyses: {
  fieldId: text("field_id").notNull().references(() => fields.id, { onDelete: "restrict" }),
}
recommendations: {
  analysisId: text("analysis_id").notNull().references(() => analyses.id, { onDelete: "cascade" }),
}
```

- `restrict` prevents accidental cascading deletion of historical data.
- `cascade` on recommendations because they're derivative artifacts.
- Deletion UI: **none in MVP**. If an operator needs to delete, they use the CLI or SQL directly. Document in README.

### 9.2 Soft delete

Not needed in MVP. Adding later would mean `deleted_at TIMESTAMP` + filter all reads. Flagged in §15 as a potential polish item.

### 9.3 Seed determinism

`bun run seed --seed=2026` uses that number to seed a PRNG (`seedrandom`). Output is byte-identical across runs. This is critical for the demo video — the graphs must look the same every time the recording is re-done.

```ts
import seedrandom from "seedrandom";
const rng = seedrandom(process.argv[2] ?? "agrosmart-2026");
```

Uses `INSERT OR IGNORE` with deterministic ids (`seed:<farm>:<field>:<n>`) so re-running seed doesn't duplicate.

### 9.4 Timestamp policy

- Store as **Unix epoch milliseconds** (`integer_timestamp` mode in Drizzle) — SQLite's TEXT datetime is a trap.
- Always UTC at storage; convert to `America/Sao_Paulo` at render using `date-fns-tz`.
- `captured_at` (when the photo was taken) vs `created_at` (when the row was inserted) are distinct columns. Seed rows set `captured_at` to synthetic past dates; `created_at = now()`. Uploads set both to `now()` (no EXIF-based capture detection in MVP).

---

## 10. LLM recommendations layer

### 10.1 Prompt structure

System prompt (stable, versioned in `shared/lib/llm/prompts.ts`):

```
Você é um agrônomo consultor. Com base nos dados agregados da fazenda,
escreva um resumo executivo em português-brasileiro, em no máximo 4
parágrafos curtos. Destaque tendências de severidade, fazendas/talhões
de maior risco e 3 ações priorizadas. Não invente dados fora do que
foi fornecido. Se os dados forem insuficientes, diga explicitamente.
Não use markdown, só texto corrido.
```

User prompt contains a **compact JSON data summary** (not the raw rows):

```json
{
  "period_days": 30,
  "totals": { "analyses": 412, "healthy": 278, "beginning": 89, "diseased": 45 },
  "top_fields_by_severity": [
    { "farm": "Fazenda Alfa", "field": "Talhão 3", "avg_pct": 18.4, "n": 42 }
  ],
  "pest_breakdown": [ { "pest": "ferrugem", "count": 30 } ],
  "week_over_week_delta": { "healthy_pct": -3.2, "diseased_pct": +1.1 }
}
```

### 10.2 Caching

- Cache key = `sha256(JSON.stringify(data_summary_in_canonical_order))`. Same summary → same cached text.
- Store in a `llm_cache` table: `(key PRIMARY KEY, text, model, created_at)`. TTL enforced at read (`created_at > now - 6h`).
- This also means seed-only dashboards produce **one** LLM call total (because the summary is deterministic under seed) — great cost control.

### 10.3 Cost control

- `maxOutputTokens: 600`, `maxInputTokens: 4000` (enforced by truncating `top_fields_by_severity` to 10).
- Hard budget: env var `LLM_MAX_CALLS_PER_HOUR=20`. Counter in memory; past that, return fallback.
- Model: `google/gemini-2.5-flash-lite` via OpenRouter — cheapest viable.

### 10.4 Guardrails

- The response is displayed inside a `<p>` with `whitespace-pre-wrap` — no HTML interpretation.
- Disclaimer always visible below the card: "Sugestões geradas por IA. Valide com um agrônomo antes de aplicar no campo."
- Fallback copy per severity exists in `shared/lib/llm/fallbacks.ts`. Used when LLM fails.

### 10.5 Streaming UI

- Use `streamText` from `ai` SDK. Server Action returns a `ReadableStream`; client component reads with `useCompletion` from `@ai-sdk/react`.
- While streaming: skeleton replaced by progressively revealed text; no layout shift because card height is reserved.
- On stream error mid-flight: abort, show fallback, toast quietly.

---

## 11. Docker & deployment

### 11.1 Dockerfiles

**`web/Dockerfile`** (multi-stage):

```dockerfile
# ---- deps ----
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build ----
FROM oven/bun:1.1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ---- runtime ----
FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O- http://localhost:3000/api/health || exit 1
CMD ["bun", "server.js"]
```

Notes:
- `next.config.ts` must set `output: "standalone"`.
- `sharp` works on Alpine via `@img/sharp-linux-x64`/`-arm64`; if build fails, switch base to `oven/bun:1.1-debian-slim`.

**`api/Dockerfile`** (OpenCV needs system libs):

```dockerfile
FROM python:3.12-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libmagic1 && \
    rm -rf /var/lib/apt/lists/*
RUN useradd --system --create-home app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health').read()" || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Each service exposes `GET /health` returning `{ok: true, version}`.

### 11.2 docker-compose

**`docker-compose.yml`** (base, shared between dev and prod):

```yaml
services:
  web:
    build:
      context: ./web
    environment:
      - DB_PATH=/data/agrosmart.db
      - UPLOADS_DIR=/data/uploads
      - API_BASE_URL=http://api:8000
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - UPLOAD_AUDIT_SALT=${UPLOAD_AUDIT_SALT}
      - AGROSMART_PUBLIC_ORIGIN=${AGROSMART_PUBLIC_ORIGIN}
    volumes:
      - data:/data
    networks: [internal, public_net]
    depends_on:
      api:
        condition: service_healthy
    stop_grace_period: 20s

  api:
    build:
      context: ./api
    networks: [internal]
    volumes:
      - data:/data
    stop_grace_period: 20s

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks: [public_net]
    environment:
      - AGROSMART_DOMAIN=${AGROSMART_DOMAIN}
    depends_on: [web]

networks:
  internal:
    internal: true
  public_net: {}

volumes:
  data:
  caddy_data:
  caddy_config:
```

**`docker-compose.dev.yml`** (override): binds `./web` and `./api` for hot reload, replaces `web` command with `bun run dev`, `api` command with `uvicorn --reload`, and **drops Caddy + the `internal: true` constraint** so ports 3000 and 8000 can be published locally.

**`docker-compose.prod.yml`** (override): pins image tags, removes source binds, keeps `internal: true`.

Usage:
- Dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`
- Prod: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

### 11.3 Graceful shutdown

- **Web**: Next.js 16 standalone server handles SIGTERM and drains in-flight requests by default. `stop_grace_period: 20s` gives it room.
- **API**: uvicorn handles SIGTERM; any ongoing `asyncio.wait_for` is cancelled gracefully. Temp files cleaned in `finally`.
- **SQLite**: `process.on('beforeExit', () => sqlite.close())` in a `shared/db/client.ts` singleton; WAL checkpoint is automatic.

### 11.4 Volume persistence

- `data` named volume survives `docker compose down`. Lost only on explicit `docker volume rm`.
- Backup runbook (manual): `docker run --rm -v agrosmart_data:/data -v $PWD:/backup alpine tar czf /backup/data-$(date +%F).tgz /data`. Document in `docs/runbook.md`.

### 11.5 VPS deploy runbook

```
# local
git add . && git commit -m "feat: ..." && git push origin main

# remote
cd /home/deploy/agrosmart-fase-2
git pull --ff-only
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose logs --tail=100 -f
```

First-time setup: `.env.production` placed by hand, `data` volume seeded via `docker compose run --rm web bun run seed`.

---

## 12. Directory tree (final)

```
agrosmart-fase-2/
├── .agent/                           # agent workspace (gitignored contents except TEMPLATE)
├── docs/
│   ├── superpowers/specs/            # this file lives here
│   ├── runbook.md                    # deploy + backup + recovery
│   └── architecture.md               # links to this spec + diagrams
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              # dashboard
│   │   │   ├── loading.tsx
│   │   │   ├── upload/page.tsx
│   │   │   ├── analyses/[id]/page.tsx
│   │   │   ├── report/page.tsx       # pdf export
│   │   │   ├── admin/audit/page.tsx
│   │   │   └── api/
│   │   │       ├── health/route.ts
│   │   │       ├── metrics/route.ts
│   │   │       └── images/[kind]/[hash]/route.ts
│   │   ├── features/
│   │   │   ├── kpis/
│   │   │   ├── time-series/
│   │   │   ├── pest-breakdown/
│   │   │   ├── farm-heatmap/
│   │   │   ├── calendar-heatmap/
│   │   │   ├── farm-score/
│   │   │   ├── gallery/
│   │   │   ├── upload/
│   │   │   ├── recommendations/
│   │   │   └── report/
│   │   └── shared/
│   │       ├── components/ui/        # shadcn/ui primitives
│   │       ├── components/charts/
│   │       ├── components/layout/
│   │       ├── hooks/
│   │       ├── lib/
│   │       │   ├── errors.ts
│   │       │   ├── error-copy-pt.ts
│   │       │   ├── circuit-breaker.ts
│   │       │   ├── rate-limit.ts
│   │       │   ├── logger.ts
│   │       │   ├── metrics.ts
│   │       │   ├── hash.ts
│   │       │   ├── fs-safe.ts
│   │       │   └── llm/
│   │       │       ├── client.ts
│   │       │       ├── prompts.ts
│   │       │       ├── fallbacks.ts
│   │       │       └── cache.ts
│   │       └── db/
│   │           ├── client.ts
│   │           ├── schema.ts
│   │           ├── queries/
│   │           │   ├── kpis.ts
│   │           │   ├── time-series.ts
│   │           │   ├── heatmap.ts
│   │           │   ├── gallery.ts
│   │           │   └── audit.ts
│   │           └── seed.ts
│   ├── drizzle/
│   │   ├── 0000_init.sql
│   │   └── meta/
│   ├── public/
│   ├── biome.json
│   ├── drizzle.config.ts
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── bun.lock
│   ├── Dockerfile
│   └── .dockerignore
├── api/
│   ├── main.py
│   ├── analysis.py
│   ├── validation.py                 # mime sniff, size, bomb guard
│   ├── logging_config.yaml
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Caddyfile
├── .env.example
├── .gitignore
├── .gitattributes
├── README.md
└── LICENSE
```

Key gitignored paths: `node_modules`, `.next`, `data/`, `.env`, `.env.production`, `*.db`, `*.db-wal`, `*.db-shm`.

---

## 13. Development workflow

### 13.1 First run (zero to dashboard)

```bash
# 1. Clone + install
git clone <repo> && cd agrosmart-fase-2
cp .env.example .env

# 2. Start api in dev
docker compose -f docker-compose.yml -f docker-compose.dev.yml up api -d

# 3. Web side (on host, not in container — fastest HMR)
cd web
bun install
bun run db:generate              # drizzle-kit generate
bun run db:migrate               # apply SQL migrations
bun run seed                     # populate with deterministic synthetic data
bun run dev                      # Next.js on :3000
```

Alternative: run everything in Docker via dev override — slower HMR but one command.

### 13.2 Package scripts (web/package.json)

```json
{
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

### 13.3 Schema migrations

- Generate: `bun run db:generate` → writes SQL to `drizzle/`.
- Apply: `bun run db:migrate` (a 15-line script using `drizzle-orm/better-sqlite3/migrator`).
- Never `drizzle-kit push` in production. `push` is dev-only when schema is churning.
- Migration files are committed. Production applies them on container start via an entrypoint step (optional MVP; manual for now).

### 13.4 FastAPI hot reload

Dev override sets `command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app`. Source bound from `./api`.

---

## 14. Build sequence / phases

Each phase ends in something demoable.

### Phase 1 — Scaffolding & data model (1 day)
- Next.js 16 app router scaffold, shadcn/ui init, Tailwind v4 config.
- Drizzle schema + first migration.
- `.env.example`, `biome.json`, tsconfig, package scripts.
- `shared/db/client.ts` with PRAGMAs.
- Seed script with deterministic PRNG.
- **Demo**: `bun run seed && bun run db:studio` — browse generated data.

### Phase 2 — Dashboard read path (2 days)
- KPI cards (RSC) + time series + pest breakdown + heatmap.
- `unstable_cache` with tags.
- Suspense boundaries + skeletons.
- **Demo**: seeded dashboard renders all charts.

### Phase 3 — FastAPI analysis service (1 day)
- Port Phase 1 logic to `api/analysis.py`.
- Validation middleware (MIME sniff, size, bomb guard).
- `/analyze` + `/health` + structured logging.
- Dockerfile, compose entry.
- **Demo**: `curl -F "image=@leaf.jpg" -F "request_id=$(uuidgen)" http://localhost:8000/analyze` returns JSON.

### Phase 4 — Upload flow (1.5 days)
- Server Action with idempotency (§2.2).
- Dropzone component + disabled state + toasts.
- `sharp` thumbnail generation.
- Image serving route with path-traversal guard (§4.4–4.5).
- Dedup on sha256 (§2.1).
- `revalidatePath` / tags after success.
- **Demo**: drop image → see it appear in gallery → detail page shows annotated version.

### Phase 5 — Observability & resilience (1 day)
- pino + request IDs.
- Metrics endpoint.
- Circuit breaker.
- Rate limiter.
- Audit table + `/admin/audit` page.
- Error copy map + toast UX.
- **Demo**: stop api container mid-upload → graceful error + circuit opens.

### Phase 6 — LLM recommendations + report (1.5 days)
- Vercel AI SDK + OpenRouter client.
- Cache table + TTL read.
- Streaming UI in recommendation card.
- Fallbacks per severity.
- Report page + `react-pdf` export.
- **Demo**: click "Gerar relatório" → streamed recommendation + downloadable PDF.

### Phase 7 — Deploy + polish (1 day)
- Multi-stage Dockerfiles verified on a clean host.
- Caddy config + TLS via Let's Encrypt (automatic in Caddy).
- Deploy to openclaw VPS; verify Tailscale access to `data` volume backups.
- README with architecture diagram, runbook, "Known limitations" (§Q3 coupling), and demo video link.
- `scripts/smoke.sh` + fixture images (`scripts/fixtures/healthy-leaf.jpg`, `diseased-leaf.jpg`) — see §Q8.
- `robots.txt` with `Disallow: /admin/` — see §Q7.
- **Demo**: public URL serves the dashboard, upload works end-to-end over HTTPS, `./scripts/smoke.sh` exits 0.

### Phase 8 — Video demo (0.5 day)
- Record walkthrough hitting every feature.
- Upload example leaf images.
- Narrate architecture choices (this doc is the script source).

**Total estimate**: ~8 working days. Slippage budget: +2 days for OpenCV Alpine pain, Recharts SSR quirks, or Caddy TLS troubleshooting on the VPS.

---

## 15. Open questions / risks — DECISIONS LOCKED 2026-04-17

### Q1. Pest type for uploads — **DECISION: dropdown manual**
User chose dropdown on upload. Add `pest_type_manual` column (nullable) OR reuse `pest_type` column and populate from a dropdown in the upload form. Use a shared enum `PEST_TYPES = ['ferrugem', 'mancha_parda', 'oidio', 'lagarta', 'nao_identificado']` (5 options, last is default). UI requirement: dropdown REQUIRED in the upload form, pre-selected to `nao_identificado`, with a "Não sei" helper tooltip.

### Q2. Should `api` also write to SQLite instead of just returning JSON?
**No** — the current design (web owns DB, api is stateless) is correct. Flagging to confirm you haven't drifted. Keeping api stateless means it can be restarted/replaced freely, and we have one writer.

### Q3. Annotated image: return bytes or write to volume? — **DECISION: volume (for now)**
User prefers independent services long-term; accepts volume coupling for MVP. **Action item**: document the coupling in README "Known limitations" and add a `TODO(decouple)` comment in `api/main.py` at the volume write site, so the upgrade path to base64 return is visible. Future migration is a ~30-line change on both sides.

### Q4. Image served from Next.js vs Caddy directly?
I chose Next.js handler for ETag + sniffed-MIME serving. Alternative: `file_server /images/* /data/uploads` directly in Caddy (faster, no Node trip). **Recommendation**: stick with Next handler — uploads need the path-traversal regex validation, and serving a static prefix opens attack surface.

### Q5. Seed dates — **DECISION: relative to `now()` with deterministic PRNG**
Seed script computes `captured_at = now() - prng_offset_days(...)` where `prng_offset_days` is driven by a fixed seed value (e.g. `SEED=42`). Evergreen charts, still reproducible run-to-run on the same day. Document `SEED` env var in `.env.example`.

### Q6. LLM cost ceiling monitoring
`LLM_MAX_CALLS_PER_HOUR` is enforced but there's no alert when we hit it. For a demo that's fine. Flagging: if this goes on a portfolio for a year and someone stumbles on the public URL, 20 calls/hour × 24 × 365 = 175k calls. At Gemini Flash Lite prices, worst case ~$5–15/month. Acceptable. If you want a hard monthly cap, add a `llm_calls_this_month` counter with a persistent row.

### Q7. `/admin/audit` auth — **DECISION: no auth (keep public)**
User explicitly chose to keep `/admin/audit` public. Accept the trade. Mitigations still required: (a) hash IPs with a per-install salt so the raw IP is never reconstructable, (b) do NOT display user-agent strings, (c) cap audit page pagination to 100 rows to prevent full-table scraping, (d) add `noindex, nofollow` robots meta + `robots.txt` Disallow for `/admin/`. Document the decision in README.

### Q8. `scripts/smoke.sh` — **DECISION: allowed as ops tool**
Added to Phase 7 deliverables. Script must: (1) `curl /api/health` on web and api, (2) POST a fixture image from `scripts/fixtures/healthy-leaf.jpg`, (3) assert HTTP 200 + JSON contains `severity`, (4) `rm` the created `analyses` row via a dev-only endpoint OR via direct sqlite3 cleanup, (5) exit non-zero on any failure. Run it manually post-deploy: `ssh openclaw 'cd /home/deploy/agrosmart && ./scripts/smoke.sh'`.

### Q9. Disk usage growth
At 2 MB average per upload × thumbs × annotated = ~4 MB/upload. A VPS with 20 GB free survives 5,000 uploads. For a demo it's fine, but documenting the ceiling lets you say "the 'X' limit" when asked in a portfolio interview. **Recommendation**: add a max-upload-count check (`select count(*) from analyses where source='upload'`) and reject past 2,000 with a polite message. One-line guard, big resilience story.

### Q10. PRAGMA `mmap_size = 256MB`
This works on Linux and macOS. If anyone runs dev on Windows (unlikely given your setup), it no-ops silently. Non-blocker, documented for completeness.

---

## 16. Appendix — Copy strings (pt-BR) for reference

Centralize in `web/src/shared/lib/error-copy-pt.ts`:

```ts
export const ERROR_COPY_PT: Record<ActionErrorCode, string> = {
  API_UNAVAILABLE: "Serviço de análise indisponível. Tente em alguns instantes.",
  IMAGE_TOO_LARGE: "A imagem é grande demais. Use até 8 MB.",
  INVALID_MIME: "Formato não suportado. Use JPG, PNG, WEBP ou BMP.",
  DECODE_FAILED: "Não foi possível decodificar a imagem.",
  NO_LEAF_DETECTED: "Não identificamos folha na imagem. Envie uma foto mais próxima.",
  DUPLICATE: "Esta imagem já foi analisada anteriormente.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos.",
  DISK_FULL: "Espaço insuficiente no servidor.",
  TIMEOUT: "A análise demorou demais. Tente novamente com uma imagem menor.",
  INTERNAL: "Algo deu errado. Tente novamente.",
};
```

UI components import and render `ERROR_COPY_PT[error.code]` — never concatenate server strings.

---

**End of spec.**
