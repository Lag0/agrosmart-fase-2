# AgroSmart Fase 2

Dashboard para análise de doenças em plantas, upload de imagens, persistência em SQLite e recomendações agronômicas.

## Arquitetura

- **Web**: Next.js 16 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **API**: FastAPI (Python 3.12) + OpenCV + Pillow para análise de imagens
- **Banco**: SQLite (WAL mode) + Drizzle ORM
- **Proxy**: Caddy (TLS, rate limiting, gzip)
- **Infra**: Docker Compose multi-stage

## Estrutura do Projeto

```
agrosmart-fase-2/
├── api/                    # FastAPI service
│   ├── app/               # Código da aplicação
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example       # Template de variáveis
├── web/                   # Next.js frontend
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   └── next.config.ts
├── data/                  # Volume compartilhado (SQLite + uploads)
├── docs/                  # Documentação técnica
├── scripts/               # Scripts utilitários
├── docker-compose.yml     # Configuração base
├── docker-compose.dev.yml # Overrides para desenvolvimento
├── docker-compose.prod.yml# Overrides para produção
├── Caddyfile             # Configuração do proxy
└── .env.example          # Variáveis de ambiente
```

## Quick Start

### Requisitos

- Docker e Docker Compose
- Ou Node.js 20+ e Bun 1.2+ (para desenvolvimento local)
- Python 3.12+ (para API local)

### 1. Clone e configure

```bash
git clone https://github.com/seu-usuario/agrosmart-fase-2.git
cd agrosmart-fase-2

# Copie os templates de variáveis
cp .env.example .env
cp api/.env.example api/.env

# Edite os arquivos .env com suas configurações
```

### 2. Execute com Docker (Recomendado)

```bash
# Desenvolvimento
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Produção
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Acesse: http://localhost:3000

### 3. Desenvolvimento Local (Alternativo)

**Terminal 1 - API:**
```bash
cd api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 - Web:**
```bash
cd web
bun install
bun run db:migrate
bun run seed
bun run dev
```

Acesse: http://localhost:3000

## Variáveis de Ambiente

### Root (.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DB_PATH` | Caminho do SQLite | `/data/agrosmart.db` |
| `UPLOADS_DIR` | Diretório de uploads | `/data/uploads` |
| `API_BASE_URL` | URL interna da API | `http://api:8000` |
| `OPENROUTER_API_KEY` | Chave da API OpenRouter (opcional) | - |
| `UPLOAD_AUDIT_SALT` | Salt para hash de audit | - |
| `AGROSMART_DOMAIN` | Domínio para Caddy | `localhost` |
| `AGROSMART_PUBLIC_ORIGIN` | Origem pública | `http://localhost:3000` |
| `LLM_MAX_CALLS_PER_HOUR` | Limite de chamadas LLM | `20` |

### API (api/.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `AGROSMART_UPLOADS_DIR` | Diretório de uploads | `/data/uploads` |
| `AGROSMART_OPENROUTER_API_KEY` | Chave OpenRouter | - |
| `AGROSMART_API_VERSION` | Versão da API | `1.0.0` |
| `AGROSMART_CORS_ORIGINS` | Origens CORS | `http://localhost:3000` |

## Funcionalidades

### Core
- [x] Dashboard com KPIs (total, saudável %, doente %, tipos de pragas)
- [x] Gráfico de série temporal (últimos 30 dias)
- [x] Distribuição por tipo de praga
- [x] Mapa de calor por talhão
- [x] Upload com dropzone, deduplicação SHA-256
- [x] Exibição de imagens anotadas (bounding boxes)
- [x] Trail de auditoria (IP/UA hashed)

### Diferenciais
- [x] Classificação por IA (OpenRouter/Gemini) com fallback
- [x] Exportação de relatórios PDF
- [x] Seed determinístico para dados reproduzíveis
- [x] Circuit breaker para falhas de API
- [x] Thumbnails automáticos
- [x] Multi-stage Docker builds

## API Endpoints

### Health
- `GET /health` - Status do serviço

### Analysis
- `POST /analyze` - Análise de imagem (HSV-based)
- `GET /images/annotated/{request_id}` - Download imagem anotada

### Classification
- `POST /classify` - Classificação por VLM (OpenRouter)

## Scripts Úteis

```bash
# Web
cd web
bun run db:generate    # Gerar migrações Drizzle
bun run db:migrate     # Aplicar migrações
bun run seed           # Popular banco com dados sintéticos
bun run lint           # Verificar código
bun run build          # Build de produção

# API
cd api
.venv/bin/python -m pytest  # Rodar testes (se existirem)
```

## Decisões de Arquitetura

1. **Volume compartilhado**: Web e API compartilham `/data/uploads` via volume Docker (aceitável para MVP, documentado para migração futura)
2. **SQLite WAL mode**: Single writer (Next.js), múltiplos readers
3. **Classificação manual + IA**: Dropdown manual com fallback para classificação por LLM
4. **Audit público**: `/admin/audit` sem auth mas com dados hasheados

## Limitações Conhecidas

- [ ] Upload de imagens HEIC no iPhone pode apresentar problemas (ver Issue #1)
- [ ] Shared upload volume entre web e api (coupling aceitável para MVP)
- [ ] `/admin/audit` é público por design (dados hasheados + paginação)

## Licença

MIT - Ver [LICENSE](./LICENSE)

## Contribuição

Este é um projeto acadêmico da FIAP - Pós-Graduação em Engenharia de Agronomia.

## Issues Conhecidas

- [Issue #1: Upload de imagem no iPhone não funciona](https://github.com/seu-usuario/agrosmart-fase-2/issues/1) - Imagens selecionadas via Photos ou Files no iPhone não aparecem no preview e o botão de análise não é ativado.
