# Relatório Técnico — AgroSmart Fase 2

**Curso:** Pós-Graduação em Engenharia de Agronomia — FIAP  
**Projeto:** AgroSmart — Sistema de Visão Computacional para Diagnóstico de Doenças em Plantas  
**Período:** Abril/2026

---

## 1. Visão Geral

O AgroSmart é um sistema fullstack que combina análise de imagens por visão computacional (HSV) com classificação de pragas por modelo visual-linguístico (VLM), apresentando os resultados em um dashboard interativo. O agricultor fotografa uma folha, faz upload pela interface web, e recebe em segundos a severidade, o tipo de praga sugerido pela IA, e a imagem anotada com as regiões doentes destacadas.

### Evolução em relação à Fase 1

| Aspecto | Fase 1 | Fase 2 |
|---|---|---|
| Interface | Script CLI em Python | Dashboard web responsivo |
| Persistência | Exportação CSV/JSON | SQLite com Drizzle ORM |
| Análise | OpenCV standalone | FastAPI microservice com thumbnails |
| Classificação | Manual (saúdavel/doente) | VLM (OpenRouter/Gemini) + manual |
| Visualização | Tabela de resultados | KPIs, gráficos, heatmap, galeria |
| Exportação | CSV básico | CSV, JSON, PDF |
| Deploy | Script local | Docker Compose multi-stage |

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────┐
│               Caddy (proxy)                 │
│         TLS · gzip · rate-limit             │
└──────────────┬──────────────┬───────────────┘
               │              │
       ┌───────▼──────┐ ┌────▼─────────┐
       │   Web (3000)  │ │  API (8000)   │
       │   Next.js 16  │ │  FastAPI      │
       │   React 19    │ │  Python 3.12  │
       │   SQLite RW   │ │  OpenCV       │
       │   Drizzle ORM │ │  OpenRouter   │
       └───────┬───────┘ └──────┬────────┘
               │                 │
         ┌─────▼─────┐    ┌─────▼─────┐
         │  SQLite DB │    │  /uploads │
         │  (WAL)     │    │  (shared) │
         └────────────┘    └───────────┘
```

### Decisões arquiteturais documentadas (ADRs)

- **ADR-001**: API egress para OpenRouter — permite que o serviço FastAPI acesse `openrouter.ai` exclusivamente para chamadas VLM. Fallback gracioso em caso de indisponibilidade.

---

## 3. Pipeline de Análise

### 3.1 Análise HSV (FastAPI — `/analyze`)

O pipeline de visão computacional preserva byte-a-byte os thresholds da Fase 1:

1. **Carregamento** da imagem (JPEG, PNG, WebP, BMP)
2. **Validção MIME** — detecção por header bytes (fallback para `python-magic`)
3. **Conversão** BGR → HSV
4. **Segmentação** por faixas de cor:
   - Verde (folha saudável): H 35–85, S 40–255, V 40–255
   - Amarelo (indicador de doença): H 15–35, S 40–255, V 40–255
   - Marrom (indicador de doença): H 5–20, S 40–255, V 30–200
5. **Operações morfológicas** — CLOSE + OPEN com kernel 5×5
6. **Cálculo da severidade**:
   - `plant_pixels = green ∪ yellow ∪ brown` (pixels de folha)
   - `disease_pixels = yellow ∪ brown` (pixels suspeitos)
   - `affected_pct = disease_pixels / plant_pixels × 100` (clamped a 100%)
7. **Classificação**:
   - < 5% → `healthy` (Planta saudável)
   - 5–15% → `beginning` (Possível início de doença)
   - \> 15% → `diseased` (Planta doente)
8. **Anotação visual** — bounding boxes vermelhos nas regiões detectadas

### 3.2 Classificação VLM (FastAPI — `/classify`)

Classificação do tipo de praga via modelo visual-linguístico:

- **Modelo**: `google/gemini-3.1-flash-lite-preview` via OpenRouter
- **Abordagem**: prompt estruturado em português com diagnóstico diferencial
- **Cache**: in-memory por SHA-256 (TTL configurável)
- **Fallback**: em caso de indisponibilidade, retorna `nao_identificado` com confiança 0

**Árvore de decisão do prompt (texture-first)**:

```
TEXTURA → ELEVADA + pulverulenta → Ferrugem
        → PLANA + necrótica → Mancha parda
        → BRANCO pulverulento removível → Oídio
        → TECIDO removido fisicamente → Lagarta
        → NENHUMA das anteriores → Outro
```

### 3.3 Fluxo de Upload (Web → API)

O upload aciona análises HSV e VLM **em paralelo**:

```
Cliente → Server Action → POST /analyze ────┐
                                     POST /classify ─┤
                                                        ├→ Merge → SQLite → Response
```

- **Dedup**: SHA-256 da imagem é verificado antes de processar
- **Resiliência**: falha na classificação IA não bloqueia o upload
- **Thumbnails**: gerados automaticamente pelo serviço de análise

---

## 4. Banco de Dados

SQLite em modo WAL com as seguintes tabelas:

| Tabela | Descrição |
|---|---|
| `farms` | Fazendas cadastradas |
| `fields` | Talhões vinculados a fazendas |
| `analyses` | Resultados de análise (severidade, pragas, pixels, caminhos de imagem, IA) |
| `recommendations` | Recomendações geradas por LLM |
| `llm_cache` | Cache de respostas de IA por chave |
| `uploads_audit` | Trilha de auditoria de uploads (IP/UA hasheados) |

**Migrações**: Drizzle Kit (`web/drizzle/0001_*.sql`)

**Seed determinístico**: `bun run seed` gera ~354 análises com `seedrandom` para reprodutibilidade.

---

## 5. Funcionalidades Implementadas

### 5.1 Dashboard (`/`)

- KPIs: total de análises, % saudáveis, % doentes, tipos de praga
- Gráfico de série temporal (últimos 30 dias, por severidade)
- Gráfico de distribuição por tipo de praga (barras + pizza)
- Mapa de calor por talhão/fazenda
- Galeria de análises recentes com thumbnail e badge de confiança IA
- Botão **Exportar** (CSV / JSON)

### 5.2 Upload (`/upload`)

- Dropzone com drag-and-drop e seleção de arquivo
- Seleção manual do tipo de praga (dropdown)
- Processamento paralelo: HSV + VLM
- Exibição do resultado com:
  - Severidade e % área afetada
  - Sugestão da IA com badge de confiança (verde ≥70%, amber ≥40%, vermelho <40%)
  - Justificativa da IA (expandível)
  - Aviso de baixa confiança quando < 40%
- Deduplicação por SHA-256
- Compatibilidade com iOS/Safari (fallback de MIME type)

### 5.3 Detalhe da Análise (`/analyses/[id]`)

- Comparação imagem original × anotada (tabs)
- Card de classificação por IA (praga, confiança, modelo, justificativa)
- Card de resumo (severidade, área afetada, pixels, talhão)
- Card de metadados (IDs, timestamps, SHA-256, files disponíveis)
- Aviso de "folha não detectada" quando aplicável

### 5.4 Lista de Análises (`/analyses`)

- Tabela paginada (desktop) + cards (mobile)
- Resolução inteligente: se praga manual = "Não identificado", mostra sugestão IA
- Badge de severidade colorido

### 5.5 Relatório (`/report`)

- Relatório operacional com KPIs, distribuição de pragas, recomendação
- Exportação PDF via `@react-pdf/renderer` (`GET /api/report/pdf`)
- Exportação CSV/JSON (`GET /api/export?format=csv|json`)
- Codificação UTF-8 com BOM para compatibilidade Excel

### 5.6 Auditoria (`/admin/audit`)

- Trilha de uploads com IP/UA hasheados (privacidade)
- Paginação e filtros

---

## 6. Tecnologias Utilizadas

### Backend — API (Python)

| Tecnologia | Versão | Uso |
|---|---|---|
| FastAPI | 0.115.12 | Framework web |
| OpenCV | 4.11.0 | Processamento de imagens (HSV) |
| Pillow | 11.2.1 | Geração de thumbnails |
| python-magic | 0.4.27 | Detecção MIME |
| OpenAI SDK | 1.75.0 | Cliente para OpenRouter/Gemini |
| Pydantic | 2.x | Validação e serialização |
| NumPy | 2.2.5 | Operações matriciais |
| Uvicorn | 0.34.2 | Servidor ASGI |

### Frontend — Web (TypeScript)

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 16.0 | Framework web com RSC |
| React | 19.2 | Interface do usuário |
| TypeScript | 5.9 | Tipagem estática |
| Tailwind CSS | 4.2 | Estilização |
| shadcn/ui | latest | Componentes de UI |
| Drizzle ORM | 0.44 | ORM para SQLite |
| better-sqlite3 | 12.2 | Driver SQLite nativo |
| Recharts | 3.8 | Gráficos interativos |
| @react-pdf/renderer | 4.1 | Geração de PDF |
| @remixicon/react | 4.9 | Ícones |
| Sharp | 0.34 | Processamento de imagens (thumbnails) |

### Infraestrutura

| Tecnologia | Uso |
|---|---|
| Docker Compose | Orquestração multi-service |
| Caddy | Proxy reverso com TLS automático |
| SQLite (WAL) | Banco de dados embutido |
| Multi-stage Docker | Builds otimizados para produção |

---

## 7. Modelo de Dados (Diagrama)

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐
│  farms   │────<│  fields  │────<│    analyses       │
│──────    │     │──────    │     │──────────────────│
│ id (PK)  │     │ id (PK)  │     │ id (PK)          │
│ name     │     │ farm_id  │     │ request_id       │
│          │     │ name     │     │ image_sha256     │
└──────────┘     │          │     │ source            │
                 └──────────┘     │ field_id → fields │
                                   │ pest_type          │
                                   │ pest_type_ai       │
                                   │ pest_type_confidence│
                                   │ pest_type_reasoning │
                                   │ pest_type_model    │
                                   │ severity           │
                                   │ severity_label_pt  │
                                   │ affected_pct       │
                                   │ leaf_pixels        │
                                   │ diseased_pixels    │
                                   │ original_path      │
                                   │ annotated_path     │
                                   │ thumbnail_path     │
                                   │ warnings (JSON)    │
                                   │ captured_at        │
                                   └────────────────────┘
```

---

## 8. Fonte Única de Verdade — Tipos de Praga

Todo o sistema (backend + frontend) compartilha o mesmo conjunto de tipos de praga:

| Valor (DB/API) | Label (UI) | Curto (cards) | Cor (gráfico) |
|---|---|---|---|
| `nao_identificado` | Não identificado | Não identif. | muted |
| `ferrugem` | Ferrugem | Ferrugem | chart-1 |
| `mancha_parda` | Mancha Parda | Mancha parda | chart-2 |
| `oidio` | Oídio | Oídio | chart-3 |
| `lagarta` | Lagarta | Lagarta | chart-4 |
| `outro` | Outro | Outro | chart-5 |

**Implementação**: `web/src/shared/lib/format.ts` → `PEST_TYPES` array, importado por todos os componentes. `api/app/services/classification.py` → `VALID_PEST_TYPES` frozenset, sincronizado. Adicionar ou renomear um tipo exige alterar apenas estes dois arquivos.

---

## 9. Critérios de Aceite — Fase 2

| Requisito | Status | Descrição |
|---|---|---|
| Dashboard com métricas interativas | ✅ | KPIs, gráficos temporais, distribuição, heatmap |
| Conexão com base de dados | ✅ | SQLite + Drizzle ORM + seed determinístico |
| Upload de imagens | ✅ | Dropzone com dedup SHA-256, processamento paralelo |
| Classificação saudável/doente | ✅ | HSV com thresholds mesmos da Fase 1 |
| Identificação de tipo de praga | ✅ | VLM (OpenRouter/Gemini) + manual |
| Exportação CSV/JSON | ✅ | `GET /api/export?format=csv\|json` |
| Relatório PDF | ✅ | `GET /api/report/pdf` |
| Vídeo explicativo | ⏳ | Pendente — roteiro definido |

---

## 10. Resultados do Dataset de Teste (Fase 1)

| Imagem | Diagnóstico | Área afetada |
|---|---|---|
| image-1.jpg | Planta doente | 51.02% |
| image-2.jpg | Planta doente | 40.39% |
| image-3.jpg | Planta saudável | 0.44% |
| image-4.jpg | Planta saudável | 0.74% |
| image-5.webp | Planta doente | 73.93% |
| image-6.jpg | Planta doente | 44.85% |
| image-7.webp | Planta doente | 31.18% |

---

## 11. Aplicabilidade no Agronegócio

- **Diagnóstico rápido**: photograph + upload + resultado em segundos
- **Monitoramento contínuo**: dashboard com tendência de 30 dias
- **Decisão informada**: % de saudáveis/doentes, praga dominante, recomendação consolidada
- **Rastreabilidade**: cada análise registrada com timestamp, fazenda, talhão, SHA-256
- **Baixo custo**: sem equipamento especializado, apenas câmera do smartphone
- **Exportação para agrônomo**: CSV para planilha, PDF para relatório formal

---

## 12. Limitações Conhecidas

1. **Upload HEIC/iPhone**: formato HEIC pode não ser suportado em todos os browsers
2. **Volume compartilhado**: web e API compartilham `/data/uploads` (aceitável para MVP)
3. **VLM depende de API externa**: sem OpenRouter, classificação IA retorna `nao_identificado`
4. **Single writer SQLite**: apenas a web app escreve; VLM é read-only
5. **Sem autenticação**: projeto acadêmico sem multi-tenant

---

## 13. Decisões Técnicas Adicionais

| # | Decisão | Justificativa |
|---|---|---|
| 1 | SQLite (não Postgres) | Simplicidade para MVP, single-writer, WAL mode para concorrência |
| 2 | Server Actions (não REST) | Menos boilerplate, typesafe, co-located com UI |
| 3 | VLM no FastAPI (não web) | Separação deIA — web persiste, API computa |
| 4 | OpenRouter (não OpenAI direto) | Modelo Gemini via proxy, cacheável, menor custo |
| 5 | In-memory VLM cache | Evita chamadas duplicadas para mesma imagem |
| 6 | Tailwind v4 CSS-first | Configuração sem JS, container queries, design tokens |
| 7 | `affected_pct` clamped 100% | Fórmula `disease/plant` (não `disease/total`) + clamp |

---

*Relatório técnico gerado em abril/2026 como parte da entrega acadêmica da Fase 2 — FIAP.*