# Relatório Técnico — AgroSmart (Fase 1)

> Referência original trazida de `agrosmart-fase-1/README.md`.
> Este documento serve como base para o relatório técnico da Fase 1 + Fase 2.

---

## Descrição do Processo de Desenvolvimento

O AgroSmart é um sistema de visão computacional para identificação de doenças em plantas. Utiliza análise de cores no espaço HSV (Hue, Saturation, Value) via OpenCV para classificar folhas como saudáveis ou doentes.

O pipeline de análise funciona da seguinte forma:

1. **Carregamento** da imagem de entrada (suporta JPG, PNG, WebP, BMP)
2. **Conversão** do espaço de cor BGR → HSV
3. **Segmentação** por faixas de cor:
   - Verde (folha saudável): H 35–85, S 40–255, V 40–255
   - Amarelo (indicador de doença): H 15–35, S 40–255, V 40–255
   - Marrom (indicador de doença): H 5–20, S 40–255, V 30–200
4. **Operações morfológicas** — CLOSE (preencher buracos) e OPEN (remover ruído) com kernel 5×5
5. **Detecção da área doente** — subtração da máscara verde da máscara total da folha
6. **Cálculo da porcentagem** de área afetada em relação à área total da folha
7. **Classificação** com base nos thresholds:
   - < 5% → Planta saudável
   - 5–15% → Possível início de doença
   - > 15% → Planta doente
8. **Anotação visual** — desenho de bounding boxes vermelhos nas regiões detectadas (área mínima de 100px)

### Classificação

| Área afetada | Diagnóstico |
|---|---|
| < 5% | Planta saudável |
| 5% a 15% | Possível início de doença |
| > 15% | Planta doente |

### Resultados do Dataset de Teste

| Imagem | Diagnóstico | Área afetada |
|---|---|---|
| image-1.jpg | Planta doente | 51.02% |
| image-2.jpg | Planta doente | 40.39% |
| image-3.jpg | Planta saudável | 0.44% |
| image-4.jpg | Planta saudável | 0.74% |
| image-5.webp | Planta doente | 73.93% |
| image-6.jpg | Planta doente | 44.85% |
| image-7.webp | Planta doente | 31.18% |

## Tecnologias Utilizadas

### Fase 1 (Protótipo CLI)

- **Python** — Linguagem principal
- **OpenCV** — Processamento de imagens e segmentação por cor (HSV)
- **NumPy** — Operações numéricas sobre matrizes de pixels
- **Pandas** — Exportação dos resultados em CSV e JSON

### Fase 2 (Aplicação Fullstack)

- **Next.js 16** — Framework web com React Server Components
- **React 19** — Interface do usuário
- **TypeScript** — Tipagem estática
- **Tailwind CSS v4** — Estilização
- **shadcn/ui** — Componentes de interface
- **Drizzle ORM + better-sqlite3** — Persistência de dados (SQLite com WAL)
- **FastAPI** — API de análise de imagens
- **OpenCV (Python)** — Análise HSV (mesmo algoritmo da Fase 1)
- **Python-magic + Pillow** — Validação de imagens (MIME, decode, dimensão)
- **Docker Compose + Caddy** — Deploy e proxy reverso

## Imagens de Exemplo

### Imagens originais

Ver `scripts/fixtures/`:
- `image-1.jpg` a `image-7.jpg|webp` — dataset de 7 folhas (2 saudáveis, 5 doentes)

### Imagens anotadas (áreas detectadas em vermelho)

Ver `docs/assets/`:
- `resultado_image-1.jpg` — Folha doente com 51.02% de área afetada
- `resultado_image-2.jpg` — Folha doente com 40.39% de área afetada
- `resultado_image-3.jpg` — Folha saudável com 0.44% de área afetada
- `resultado_image-4.jpg` — Folha saudável com 0.74% de área afetada
- `resultado_image-5.webp` — Folha doente com 73.93% de área afetada
- `resultado_image-6.jpg` — Folha doente com 44.85% de área afetada
- `resultado_image-7.webp` — Folha doente com 31.18% de área afetada

## Aplicabilidade no Agronegócio

A detecção precoce de doenças em plantações é um dos maiores desafios do agronegócio brasileiro. O AgroSmart permite:

- **Diagnóstico rápido** — O agricultor tira uma foto da folha e recebe instantaneamente a classificação de saúde da planta
- **Monitoramento contínuo** — O dashboard da Fase 2 permite acompanhar a evolução da saúde das plantações ao longo do tempo
- **Decisão informada** — Métricas como percentual de folhas saudáveis vs. doentes e tendências por período ajudam o agricultor a tomar ações preventivas (controle de pragas, irrigação, poda)
- **Rastreabilidade** — Cada análise é registrada com timestamp, localização (fazenda/talhão) e tipo de praga identificado
- **Baixo custo** — Não depende de equipamentos especializados — apenas uma câmera (smartphone) e acesso ao sistema web

### Cenário de Uso

1. O agricultor fotografa uma folha suspeita no campo
2. Faz upload pela interface web ou app mobile
3. O sistema analisa a imagem e retorna a classificação (saudável / início de doença / doente)
4. O resultado é armazenado no banco de dados e reflete no dashboard
5. Ao longo do tempo, o dashboard mostra tendências que permitem ações preventivas

---

## TODO: Expandir para o relatório final

- [ ] Adicionar seção sobre a arquitetura da Fase 2 (monorepo, web + api, Docker)
- [ ] Adicionar prints do dashboard (KPIs, gráficos, heatmap, galeria)
- [ ] Adicionar prints do fluxo de upload
- [ ] Adicionar prints da navegação mobile (bottom nav)
- [ ] Adicionar seção sobre a integração Fase 1 → Fase 2
- [ ] Revisar e formatar para PDF
