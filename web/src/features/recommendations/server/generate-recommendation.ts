"use server";

import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/shared/db/client";
import { analyses, llmCache, recommendations } from "@/shared/db/schema";
import { env } from "@/shared/lib/env";
import type { ActionResult } from "@/shared/lib/errors";
import { buildFieldContext, contextCacheKey } from "./build-field-context";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";

export type GeneratedRecommendation = {
  content: string;
  model: string;
  source: "generated" | "cache";
};

const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 900;

type ChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${env.OPENROUTER_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL,
          max_tokens: MAX_TOKENS,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`OpenRouter respondeu ${response.status}`);
    }

    const payload = (await response.json()) as ChatCompletion;
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("OpenRouter retornou resposta vazia");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Gera o relatório executivo do período a partir dos dados do painel.
 *
 * O contexto injetado é o mesmo recorte de 30 dias que o dashboard exibe.
 * Respostas são cacheadas por hash do contexto: enquanto nenhuma análise nova
 * entrar, a mesma pergunta não gasta tokens de novo.
 */
export async function generateRecommendation(): Promise<
  ActionResult<GeneratedRecommendation>
> {
  if (!env.OPENROUTER_API_KEY) {
    return {
      success: false,
      error: {
        code: "API_UNAVAILABLE",
        message:
          "Chave da OpenRouter não configurada. Defina OPENROUTER_API_KEY para gerar o relatório.",
      },
    };
  }

  const context = await buildFieldContext();

  if (context.totals.analyses === 0) {
    return {
      success: false,
      error: {
        code: "INTERNAL",
        message: "Não há análises nos últimos 30 dias para gerar o relatório.",
      },
    };
  }

  const model = env.OPENROUTER_MODEL;
  const cacheKey = contextCacheKey(context, model);

  const cached = await db
    .select({ text: llmCache.text, model: llmCache.model })
    .from(llmCache)
    .where(eq(llmCache.key, cacheKey))
    .limit(1);

  if (cached[0]) {
    return {
      success: true,
      data: {
        content: cached[0].text,
        model: cached[0].model,
        source: "cache",
      },
    };
  }

  let content: string;
  try {
    content = await callOpenRouter(SYSTEM_PROMPT, buildUserPrompt(context));
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: {
        code: isTimeout ? "TIMEOUT" : "API_UNAVAILABLE",
        message: isTimeout
          ? "O modelo demorou mais de 30 segundos para responder. Tente novamente."
          : "Não foi possível gerar o relatório agora. Tente novamente em instantes.",
      },
    };
  }

  // A tabela ancora a recomendação na análise mais recente do período,
  // que é a borda do recorte usado como contexto.
  const [latest] = await db
    .select({ id: analyses.id })
    .from(analyses)
    .orderBy(desc(analyses.capturedAt))
    .limit(1);

  const now = Date.now();

  db.insert(llmCache)
    .values({ key: cacheKey, text: content, model, createdAt: new Date(now) })
    .run();

  if (latest) {
    db.insert(recommendations)
      .values({
        id: randomUUID(),
        analysisId: latest.id,
        content,
        model,
        createdAt: new Date(now),
      })
      .run();
  }

  revalidatePath("/report");

  return { success: true, data: { content, model, source: "generated" } };
}
