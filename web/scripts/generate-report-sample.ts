/**
 * Gera uma amostra do relatório executivo usando o mesmo contexto e o mesmo
 * prompt que a Server Action usa em produção.
 *
 * Serve para inspecionar a saída do modelo sem subir a interface.
 *
 * Uso: bun run scripts/generate-report-sample.ts [caminho-de-saida.md]
 */

import { writeFileSync } from "node:fs";
import {
  buildFieldContext,
  contextCacheKey,
} from "../src/features/recommendations/server/build-field-context";
import {
  buildUserPrompt,
  SYSTEM_PROMPT,
} from "../src/features/recommendations/server/prompt";

const BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const MODEL = process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-lite";
const API_KEY = process.env.OPENROUTER_API_KEY ?? "";

async function main(): Promise<number> {
  if (!API_KEY) {
    console.error("OPENROUTER_API_KEY não definida.");
    return 1;
  }

  const context = await buildFieldContext();
  const userPrompt = buildUserPrompt(context);
  const cacheKey = contextCacheKey(context, MODEL);

  console.log(`Contexto: ${context.totals.analyses} análises, ${context.fields.length} talhões`);
  console.log(`Modelo: ${MODEL}`);
  console.log(`Chave de cache: ${cacheKey.slice(0, 16)}…\n`);

  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error(`OpenRouter respondeu ${response.status}: ${await response.text()}`);
    return 1;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
  const elapsedMs = Date.now() - startedAt;

  console.log(content);
  console.log(
    `\n---\nTokens: ${payload.usage?.prompt_tokens ?? "?"} entrada / ${payload.usage?.completion_tokens ?? "?"} saída · ${elapsedMs} ms`,
  );

  const outPath = process.argv[2];
  if (outPath) {
    writeFileSync(
      outPath,
      `${content}\n\n---\n\nContexto injetado no modelo:\n\n\`\`\`\n${userPrompt}\n\`\`\`\n\nModelo: ${MODEL} · tokens: ${payload.usage?.prompt_tokens ?? "?"} entrada / ${payload.usage?.completion_tokens ?? "?"} saída · latência: ${elapsedMs} ms\n`,
      "utf-8",
    );
    console.log(`\nSalvo em ${outPath}`);
  }

  return 0;
}

main().then((code) => process.exit(code));
