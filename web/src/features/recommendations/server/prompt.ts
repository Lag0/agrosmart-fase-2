import type { FieldContext } from "./build-field-context";

export const SYSTEM_PROMPT = `Você é um engenheiro agrônomo consultor que assessora o departamento técnico de uma cooperativa agropecuária.

Você recebe o consolidado de análises de sanidade foliar feitas por produtores associados, que fotografam folhas com o celular. Cada análise traz a severidade (percentual de área foliar afetada) e a praga identificada.

SUA TAREFA
Escrever um relatório executivo curto que ajude o departamento técnico a decidir ONDE ir primeiro na próxima semana.

REGRAS
- Baseie-se exclusivamente nos números fornecidos. Não invente dados, talhões, culturas ou datas.
- Cite os números que sustentam cada afirmação.
- Priorize talhões pela severidade média e pelo volume de amostras: severidade alta com poucas amostras é sinal de incerteza, não de emergência — diga isso quando for o caso.
- A recomendação é apoio à decisão. Nunca prescreva produto comercial, dose ou intervalo de aplicação: isso cabe ao agrônomo responsável em campo.
- Se a tendência entre a primeira e a segunda metade do período for de queda, diga que o quadro está melhorando. Não force urgência que os dados não sustentam.
- Português do Brasil, tom técnico e direto. Sem saudação, sem despedida, sem emoji.

FORMATO (markdown, nesta ordem, no máximo 350 palavras)
## Situação do período
Dois a três parágrafos curtos lendo o quadro geral e a tendência.

## Prioridade de visita
Lista ordenada com no máximo 5 talhões. Para cada um: nome do talhão, severidade média, número de amostras e o motivo de estar nessa posição.

## Pontos de atenção
De 2 a 4 itens: incertezas, lacunas de amostragem, pragas em ascensão.`;

/** Serializa o contexto em texto legível — o modelo lê melhor tabela que JSON. */
export function buildUserPrompt(context: FieldContext): string {
  const { totals, trend, pests, fields, periodDays } = context;

  const pestLines = pests.length
    ? pests
        .map(
          (p) =>
            `- ${p.label}: ${p.count} análises, severidade média ${p.avgAffectedPct}%`,
        )
        .join("\n")
    : "- Sem registro de praga no período.";

  const fieldLines = fields.length
    ? fields
        .map(
          (f) =>
            `- ${f.farm} / ${f.field}: severidade média ${f.avgAffectedPct}% em ${f.samples} amostras`,
        )
        .join("\n")
    : "- Sem talhões com amostras no período.";

  const trendWord =
    trend.deltaPct > 0 ? "alta" : trend.deltaPct < 0 ? "queda" : "estabilidade";

  return `PERÍODO: últimos ${periodDays} dias

QUADRO GERAL
- Análises no período: ${totals.analyses}
- Plantas saudáveis: ${totals.healthyPct}%
- Início de doença: ${totals.beginningPct}%
- Plantas doentes: ${totals.diseasedPct}%
- Severidade média geral: ${totals.avgAffectedPct}% de área foliar afetada

TENDÊNCIA (primeira metade do período x segunda metade)
- Doentes na primeira metade: ${trend.firstHalfDiseasedPct}%
- Doentes na segunda metade: ${trend.secondHalfDiseasedPct}%
- Variação: ${trend.deltaPct > 0 ? "+" : ""}${trend.deltaPct} pontos percentuais (${trendWord})

PRAGAS IDENTIFICADAS
${pestLines}

TALHÕES, do mais afetado para o menos
${fieldLines}`;
}
