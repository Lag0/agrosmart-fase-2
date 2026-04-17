# AgroSmart Fase 2 — Contexto

## O que é

Painel de análise agregado para doenças em plantas. Consome imagens e classificações da Fase 1 (saudável / início / doente via HSV), armazena histórico em SQLite, e apresenta métricas interativas em um dashboard. Adiciona upload de imagens, integração com LLM para recomendações executivas, e geração de relatórios em PDF.

## Contexto acadêmico

**FIAP — Pós-Graduação em Engenharia de Agronomia**, disciplina PBL, Fase 2 (continuação). Critérios de avaliação: painel 40%, integração de dados 25%, vídeo 2–4 min 25%, organização 10%. Objetivo: demonstrar capacidade de persistência, visualização e consumo de um pipeline de visão computacional em produção.

## Relação com a Fase 1

A Fase 1 é um script Python (`analise_plantas.py`) que lê imagens de uma pasta, calcula mascaras HSV para segmentar folhas doentes/saudáveis, e exporta resultados em CSV/JSON. A Fase 2 reaproveita essa lógica (ranges HSV, kernels de morfologia, limiares de severidade) dentro de um microserviço FastAPI (`POST /analyze`), adicionando camadas de persistência (SQLite + Drizzle ORM), visualização interativa (Next.js RSC + Recharts) e um fluxo de upload com deduplicação e recomendações via LLM.

## Arquitetura em uma página

```
  ┌──────────────────────┐ (Caddy: TLS, rate-limit, gzip)
  │  Reverse Proxy       │
  │  Port 80/443         │
  └──────────┬───────────┘
             │
      ┌──────▼────────┐         ┌────────────────┐
      │ Next.js 16    │────────▶│ FastAPI        │
      │ (web, :3000)  │ (fetch) │ (api, :8000)   │
      │ RSC + Actions │         │ OpenCV+Pillow  │
      └────┬──────────┘         └────────────────┘
           │
    ┌──────▼──────┐              ┌─────────────────┐
    │ SQLite WAL  │              │ OpenRouter API  │
    │ (shared     │              │ (egress only)   │
    │  via Drizzle│              │ Gemini Flash    │
    │ better-    │              │ Lite            │
    │ sqlite3)   │              └─────────────────┘
    └────────────┘
         │
    ┌────▼──────────────────┐
    │ /data/uploads/        │
    │ (original + annotated │
    │ + thumbnails)         │
    └───────────────────────┘
```

**Fluxo**: Next.js valida entrada → FastAPI analisa (HSV) → web persiste em SQLite → revalidate tags → dashboard refetch → LLM gera recomendação → cache + fallback.

## Stack

- **Web**: Next.js 16, React 19, TypeScript strict, Tailwind v4, shadcn/ui, TanStack Query (server via unstable_cache), Zustand (client).
- **API**: FastAPI 0.120+, Python 3.12, OpenCV, Pillow, python-magic (MIME sniff), pydantic, python-json-logger.
- **Database**: SQLite (WAL mode), Drizzle ORM, better-sqlite3 (Node driver).
- **LLM**: Vercel AI SDK, OpenRouter, Gemini 2.5 Flash Lite.
- **Infra**: Docker Compose (multi-stage), Caddy reverse proxy, Bun runtime.
- **Observability**: pino (Node), uvicorn (FastAPI), in-memory metrics, audit trail (IP/UA hashed).

## Estrutura do repositório

```
agrosmart-fase-2/
├── docs/superpowers/specs/        # Design spec
├── web/                           # Next.js 16 + TypeScript
│   ├── src/app/                   # Routes + layouts
│   ├── src/features/              # Feature modules (feature-sliced design)
│   ├── src/shared/                # Reusable components, hooks, lib, db, llm
│   ├── drizzle/                   # Migrations
│   ├── package.json
│   ├── Dockerfile
│   └── next.config.ts
├── api/                           # FastAPI (Python 3.12)
│   ├── main.py
│   ├── analysis.py                # HSV logic ported from Phase 1
│   ├── validation.py              # MIME sniff, bomb guard
│   ├── requirements.txt
│   └── Dockerfile
├── data/                          # SQLite + uploads (volume, .gitignored)
├── scripts/                       # Seed, orphan sweep, smoke test
├── docker-compose.yml             # Base
├── docker-compose.dev.yml         # Dev overrides (binds, no Caddy)
├── docker-compose.prod.yml        # Prod overrides (image pins)
├── Caddyfile                      # TLS, CSP, HSTS
├── .env.example
├── README.md
├── CONTEXT.md                     # This file
└── LICENSE
```

## Fluxo principal

1. **Seed** → `bun run seed` popula SQLite com dados sintéticos determinísticos (baseados em PRNG seeded).
2. **Dashboard (RSC)** → Página raiz renderiza KPIs, time series, pest breakdown, heatmap via aggregated queries com `unstable_cache + revalidateTag`.
3. **Upload** → Server Action valida arquivo (MIME, size), computa SHA-256, deduplica, chama `POST /analyze`, persiste análise em SQLite, revalida tags.
4. **FastAPI** → Recebe multipart, snifa MIME, valida dimensões, executa análise HSV (ported Phase 1), retorna JSON + escreve annotated image em `/data/uploads/annotated/`.
5. **Revalidate** → Tag invalidation dispara refetch de KPIs + gallery.
6. **LLM Recommendation** → On-demand Server Action computa data summary, queryeia LLM cache, chama OpenRouter se miss, streams resposta para cliente, fallback se timeout/rate-limit.
7. **Report** → `/report` página exporta PDF com recomendação + gráfico principal.

## Funcionalidades

**Tier 1 — Core (MVP)**
- Dashboard com KPIs (total, saudável %, doente %, pest types).
- Time series chart (últimos 30 dias, por severidade).
- Pest breakdown (frequência por tipo de praga).
- Farm heatmap (avg % afetado por talhão).
- Upload com dropzone, dedup SHA-256, deduplicação por `image_sha256`.
- Annotated image display + gallery.
- Audit trail (IP + UA hashed, resultado do upload, timestamp).

**Tier 2 — Diferenciais**
- LLM executive summary (streaming) com fallback offline.
- PDF report export.
- Seed com PRNG determinístico (reproducible charts).
- Circuit breaker para falha de API.
- Rate limiting (20 uploads/h/IP).
- Request correlation IDs + estrutured logging (pino + JSON).

**Tier 3 — Polimento**
- Thumbnails geradas on-upload via sharp (320×320 webp).
- Metrics endpoint (JSON público, latency, success rates).
- `/admin/audit` page (público, mitigado com hash + paging).
- Disk-full guard + orphan sweep CLI.
- Smoke test script (`./scripts/smoke.sh`).
- Multi-stage Dockerfiles + Alpine.

## Decisões importantes

- **Monorepo com Docker Compose** — Uma aplicação coesa (web + api + caddy) deployada junto.
- **Volume compartilhado `/data/uploads`** — api escreve annotated, web serve; coupling aceitável para MVP, documentado como migração futura.
- **SQLite WAL + Pragmas** — single writer (Next.js), concurrent readers via WAL; `busy_timeout 5s`, `journal_mode=WAL`, `synchronous=NORMAL`.
- **Seed determinístico** — `seedrandom(arg)` garante dados iguais run-to-run, essencial para vídeo de demo reproducível.
- **Pest type dropdown manual** — Enum de 5 opções (ferrugem, mancha_parda, oidio, lagarta, nao_identificado); selecionado no form de upload.
- **Admin audit público** — `/admin/audit` sem auth, mas IP/UA hashed + paginated (100 rows). Documentado como trade-off demo.
- **`scripts/smoke.sh`** — Ops tool manual (não cron), testa health + upload end-to-end; parte de Phase 7.

## Fora de escopo (YAGNI explícito)

- Auth (usuários, login, RBAC).
- Multi-tenant.
- Classificação de praga via CV (manual dropdown apenas).
- Testes automatizados (E2E/unit).
- Dark mode.
- Framer Motion ou animações complexas.

## Como executar localmente (TL;DR)

```bash
cd /Users/brunolago/Developer/fiap-eng/agrosmart-fase-2

# Option A: Full Docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Option B: Web on host (faster HMR), API in Docker
docker compose -f docker-compose.yml -f docker-compose.dev.yml up api -d
cd web && bun install && bun run db:generate && bun run db:migrate && bun run seed && bun run dev
```

Open http://localhost:3000. Dashboard shows seeded data immediately.

## Como fazer deploy

```bash
# Local: commit + push
git add . && git commit -m "feat: ..." && git push origin main

# Remote (VPS openclaw via Tailscale)
ssh openclaw 'cd /home/deploy/agrosmart-fase-2 && git pull && \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml build && \
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d && \
  docker compose logs --tail=50 -f'

# Smoke test
ssh openclaw 'cd /home/deploy/agrosmart-fase-2 && ./scripts/smoke.sh'
```

Setup inicial: `.env.production` colocado à mão, `data` volume seeded via `docker compose run --rm web bun run seed`.

## Links

- **Design Spec** (fonte de verdade): `/docs/superpowers/specs/2026-04-17-agrosmart-fase-2-design.md` (seções §0–§15: system diagram, API contract, idempotency, concurrency, security, performance, data model, LLM, Docker, build phases, decisions).
- **Plan** (roadmap 8 dias, 7 phases): `/docs/superpowers/plans/2026-04-17-agrosmart-fase-2-plan.md`.
- **Fase 1** (visão computacional): `../agrosmart-fase-1/` — reaproveita análise HSV.
- **Runbook** (deploy, backup, recovery): `/docs/runbook.md` (post-launch).

---

**Última atualização**: 2026-04-17. Para detalhes de implementação, consulte o spec.
