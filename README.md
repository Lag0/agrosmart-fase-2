# AgroSmart Fase 2

> Sistema de visão computacional para diagnóstico de doenças em plantas — FIAP Pós-Graduação em Engenharia de Agronomia

Dashboard interativo com análise de imagens HSV, classificação de pragas por IA (OpenRouter/Gemini), persistência em SQLite e exportação de relatórios.

## Funcionalidades

| Recurso | Descrição |
|---|---|
| 📊 Dashboard | KPIs, gráficos temporais, distribuição de pragas, heatmap por talhão |
| 📤 Upload | Dropzone com drag-and-drop, deduplicação SHA-256, processamento paralelo |
| 🤖 Classificação IA | VLM (OpenRouter/Gemini) identifica ferrugem, mancha parda, oídio, lagarta |
| 📄 Relatório | Página de relatório consolidado + exportação PDF |
| 📥 Exportação | CSV e JSON com BOM para compatibilidade Excel |
| 🔍 Detalhe | Comparação original × anotada, card IA, metadados completos |
| 🛡️ Auditoria | Trilha de uploads com IP/UA hasheados |

## Arquitetura

```
┌────────────┐     ┌────────────┐
│   Caddy    │     │   Caddy    │
│  (proxy)   │     │  (proxy)   │
└─────┬──────┘     └─────┬──────┘
      │                  │
┌─────▼──────┐   ┌─────▼──────┐     ┌──────────────┐
│   Web      │   │    API     │─────│  OpenRouter   │
│  Next.js   │◄──│  FastAPI   │     │  (Gemini)    │
│  React 19  │   │  OpenCV    │     └──────────────┘
│  SQLite    │   │  Python    │
└─────┬──────┘   └─────┬──────┘
      │                 │
      └──────┬──────────┘
             │
       ┌─────▼─────┐
       │  /data     │
       │  SQLite DB │
       │  uploads/  │
       └────────────┘
```

### Stack

- **Web**: Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Drizzle ORM · better-sqlite3
- **API**: FastAPI · Python 3.12 · OpenCV · Pillow · OpenAI SDK (OpenRouter)
- **Infra**: Docker Compose multi-stage · Caddy (TLS, gzip, rate-limit) · SQLite WAL

## Quick Start

### Requisitos

- Docker e Docker Compose
- Ou Node.js 20+ e Bun 1.2+ (desenvolvimento local)
- Python 3.12+ (API local)

### 1. Clone e configure

```bash
git clone https://github.com/Lag0/agrosmart-fase-2.git
cd agrosmart-fase-2

cp .env.example .env
cp api/.env.example api/.env
# Edite .env e api/.env com suas configurações
```

### 2. Execute com Docker

```bash
# Desenvolvimento
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Produção
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Acesse **http://localhost:3000**

### 3. Desenvolvimento Local

**Terminal 1 — API:**
```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Web:**
```bash
cd web
bun install
bun run db:migrate
bun run seed
bun run dev
```

Acesse **http://localhost:3000**

## Variáveis de Ambiente

### Root (`.env`)

| Variável | Descrição | Padrão |
|---|---|---|
| `DB_PATH` | Caminho do SQLite | `/data/agrosmart.db` |
| `UPLOADS_DIR` | Diretório de uploads | `/data/uploads` |
| `API_BASE_URL` | URL interna da API | `http://api:8000` |
| `OPENROUTER_API_KEY` | Chave OpenRouter (opcional) | — |
| `AGROSMART_DOMAIN` | Domínio para Caddy | `localhost` |

### API (`api/.env`)

| Variável | Descrição | Padrão |
|---|---|---|
| `AGROSMART_UPLOADS_DIR` | Diretório de uploads | `/data/uploads` |
| `AGROSMART_OPENROUTER_API_KEY` | Chave OpenRouter | — |
| `AGROSMART_CORS_ORIGINS` | Origens CORS | `http://localhost:3000` |

## API Endpoints

| Método | Path | Descrição |
|---|---|---|
| `GET` | `/health` | Status do serviço API |
| `POST` | `/analyze` | Análise HSV de imagem |
| `GET` | `/images/annotated/{id}` | Download imagem anotada |
| `POST` | `/classify` | Classificação VLM (OpenRouter) |
| `GET` | `/api/health` | Status do serviço web |
| `GET` | `/api/metrics` | Métricas do sistema |
| `GET` | `/api/images/{kind}/{hash}` | Servir imagem (original/thumbnail) |
| `GET` | `/api/export?format=csv\|json` | Exportação de dados |
| `GET` | `/api/report/pdf` | Relatório em PDF |

## Estrutura do Projeto

```
agrosmart-fase-2/
├── api/                      # FastAPI microservice
│   ├── app/
│   │   ├── api/routes/       # Endpoints (analyze, classify, health)
│   │   ├── core/              # Configuração (config.py)
│   │   ├── models/            # Pydantic schemas (responses, classification)
│   │   └── services/           # Lógica (analysis.py, classification.py, validation.py)
│   ├── Dockerfile
│   └── requirements.txt
├── web/                      # Next.js frontend
│   ├── src/
│   │   ├── app/               # Rotas (pages + API routes)
│   │   ├── components/        # UI components (shadcn/ui)
│   │   ├── features/          # Feature modules (upload, report, gallery, etc.)
│   │   └── shared/            # DB (schema, queries, client), lib (format, hash)
│   ├── drizzle/               # Migrações SQL
│   ├── Dockerfile
│   └── package.json
├── data/                     # Volume (SQLite + uploads) — gitignored
├── docs/
│   ├── relatorio-tecnico.md  # Relatório técnico completo
│   ├── requisitos-fase1-fase2.md
│   └── adr/                  # Architecture Decision Records
├── scripts/
│   └── fixtures/              # Imagens de teste (Fase 1)
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Caddyfile
└── .env.example
```

## Pipeline de Análise

### Diagnóstico por HSV

```
Imagem → Validação MIME → BGR→HSV → Segmentação (verde/amarelo/marrom)
       → Morfologia (close+open) → Cálculo: disease/plant × 100
       → Classificação (<5% saudável, 5-15% início, >15% doente)
       → Anotação visual (bounding boxes) → Thumbnail
```

### Classificação por IA

```
Imagem → Base64 → OpenRouter (Gemini 3.1 Flash Lite)
       → Prompt diferencial (textura primeiro)
       → JSON: { pest_type, confidence, reasoning, alternatives }
       → Cache in-memory por SHA-256
```

O upload executa ambos **em paralelo** e funde os resultados.

## Scripts

```bash
# Web
cd web
bun run db:migrate     # Aplicar migrações
bun run seed            # Popular banco com dados sintéticos (~354 análises)
bun run lint            # Verificar código (Biome)
bun run build           # Build de produção

# API
cd api
python -m py_compile app/services/analysis.py  # Verificar sintaxe
```

## Decisões de Arquitetura

| # | Decisão | Justificativa |
|---|---|---|
| 1 | SQLite (não Postgres) | Simplicidade para MVP, single-writer, WAL mode |
| 2 | Server Actions (não REST) | Menos boilerplate, typesafe, co-located |
| 3 | VLM no FastAPI (não web) | Separação de IA — web persiste, API computa |
| 4 | OpenRouter (não OpenAI direto) | Gemini via proxy, cacheável, menor custo |
| 5 | Cache VLM in-memory | Evita chamadas duplicadas para mesma imagem |
| 6 | `affected_pct` clamped 100% | `disease/plant` (não `disease/total`) + clamp |

## Fonte Única de Verdade — Tipos de Praga

| Valor | Label | Curto | Cor |
|---|---|---|---|
| `nao_identificado` | Não identificado | Não identif. | muted |
| `ferrugem` | Ferrugem | Ferrugem | chart-1 |
| `mancha_parda` | Mancha Parda | Mancha parda | chart-2 |
| `oidio` | Oídio | Oídio | chart-3 |
| `lagarta` | Lagarta | Lagarta | chart-4 |
| `outro` | Outro | Outro | chart-5 |

**Frontend**: `web/src/shared/lib/format.ts` → `PEST_TYPES`  
**Backend**: `api/app/services/classification.py` → `VALID_PEST_TYPES`

## Limitações Conhecidas

- Upload HEIC/iPhone pode não funcionar em todos os browsers
- Volume compartilhado `/data/uploads` entre web e API (aceitável para MVP)
- `/admin/audit` é público por design (dados hasheados)
- VLM requer chave OpenRouter; sem ela, retorna `nao_identificado`

## Licença

MIT — Ver [LICENSE](./LICENSE)

## Contribuição

Projeto acadêmico — FIAP Pós-Graduação em Engenharia de Agronomia.