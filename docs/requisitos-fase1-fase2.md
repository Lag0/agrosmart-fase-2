# Requisitos — Fase 1 e Fase 2 (FIAP)

> Fonte: Briefing das atividades do curso. Salvo para referência durante o desenvolvimento.

---

## Fase 1: Reconhecimento de Imagens

### 1.1 Protótipo Funcional

Desenvolver um sistema simples de reconhecimento de imagens, que classifique elementos como "saudável" ou "doente", utilizando imagens reais ou simuladas.

- Pode ser desenvolvido com Teachable Machine, Python/OpenCV, ou qualquer outro recurso acessível.
- O reconhecimento pode ser feito via webcam, upload ou banco de imagens.

### 1.2 Exportação de Dados

Exportar os resultados da classificação em formato .csv ou .json, com dados como:

- Nome da imagem
- Categoria detectada
- Acurácia (se aplicável)

### 1.3 Relatório Técnico

Documento contendo:

- Breve descrição do processo de desenvolvimento.
- Tecnologias utilizadas.
- Imagens de exemplo.
- Aplicabilidade no agronegócio.

### 1.4 Vídeo da Aplicação

Apresentar o projeto em um vídeo de até 5 minutos em aula para explicar o funcionamento da solução.

---

## Fase 2: Dashboard Interativo

Construir um fluxo de dados que organize, armazene e apresente as imagens e resultados gerados na Fase 1. Os alunos deverão montar dashboards interativos com ferramentas acessíveis para apresentar insights relevantes sobre o campo com base em dados simulados ou coletados.

### 2.1 Painel de Visualização de Dados

Criar um dashboard interativo com dados simulados do campo, incluindo métricas como por exemplo:

- Quantidade de imagens analisadas.
- Percentual de folhas saudáveis vs. doentes.
- Frequência por tipo de praga ou anomalia.
- Tendências por período ou localidade (simulado).

> **Observação:** essas são sugestões — o grupo pode utilizar quaisquer outras métricas que julguem apropriadas.

### 2.2 Integração com Fonte de Dados

Conectar o painel a uma base de dados (pode ser uma planilha .csv, .json, Google Sheets ou banco local simulado). O fluxo deve permitir atualização simples de novos dados de imagens.

### 2.3 Vídeo Explicativo

Gravar um vídeo curto (2 a 4 minutos) explicando os principais indicadores do painel e como ele pode ajudar o agricultor a tomar decisões (ex: ações preventivas para controle de pragas, escolha de áreas para irrigação etc.).

---

## Checklist Rápido de Entrega

### Fase 1

- [ ] Protótipo funcional de classificação (saudável / doente)
- [ ] Upload de imagens funcional
- [ ] Exportação CSV/JSON com resultados
- [ ] Relatório técnico (PDF ou documento)
- [ ] Vídeo de até 5 min

### Fase 2

- [ ] Dashboard com métricas interativas
- [ ] Conexão com base de dados (atualização simples)
- [ ] Vídeo explicativo de 2 a 4 min
