"use client";

import {
  RiArrowRightLine,
  RiInformationLine,
  RiRefreshLine,
} from "@remixicon/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UploadResult } from "@/features/upload/actions/upload-image";
import { cn } from "@/lib/utils";
import {
  confidenceColor,
  formatConfidence,
  formatPestLabel,
  SEVERITY_COLORS,
} from "@/shared/lib/format";

interface UploadResultCardProps {
  result: UploadResult;
  onReset: () => void;
}

function getSeverityStyle(severity: string): {
  badgeClass: string;
  label: string;
} {
  switch (severity) {
    case "healthy":
      return {
        badgeClass: SEVERITY_COLORS.healthy,
        label: "Saudável",
      };
    case "beginning":
      return {
        badgeClass: SEVERITY_COLORS.beginning,
        label: "Início",
      };
    case "diseased":
      return {
        badgeClass: SEVERITY_COLORS.diseased,
        label: "Doente",
      };
    default:
      return {
        badgeClass: "bg-secondary text-secondary-foreground",
        label: severity,
      };
  }
}

export function UploadResultCard({ result, onReset }: UploadResultCardProps) {
  const { badgeClass } = getSeverityStyle(result.severity);
  const showAiSuggestion = result.pestTypeAi != null;
  const hasLowConfidence =
    result.pestTypeAi != null &&
    result.pestTypeAi !== "nao_identificado" &&
    (result.pestTypeConfidence ?? 0) < 0.4;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Resultado da análise</CardTitle>
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-3xl px-2.5 py-0.5 text-xs font-medium",
              badgeClass,
            )}
          >
            {result.severityLabelPt}
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {result.duplicate && (
          <div className="flex items-start gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
            <RiInformationLine className="mt-0.5 size-4 shrink-0" />
            <span>
              Esta imagem já foi analisada. Exibindo resultado existente.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">Área afetada</span>
            <span className="font-heading tabular-nums text-3xl font-bold tracking-tight">
              {result.affectedPct.toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">Severidade</span>
            <span className="text-sm font-medium">
              {result.severityLabelPt}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">Tipo de praga</span>
            <span className="text-sm font-medium">
              {formatPestLabel(result.pestType)}
            </span>
          </div>
        </div>

        {showAiSuggestion && (
          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={confidenceColor(result.pestTypeConfidence)}>
                🤖 {formatPestLabel(result.pestTypeAi ?? "nao_identificado")} •{" "}
                {formatConfidence(result.pestTypeConfidence)}
              </Badge>
              {result.pestTypeModel && (
                <span className="text-muted-foreground text-xs">
                  {result.pestTypeModel}
                </span>
              )}
            </div>

            {hasLowConfidence && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                A IA não tem certeza. Verifique visualmente.
              </p>
            )}

            {result.pestTypeReasoning && (
              <details className="group rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  <span className="group-open:hidden">
                    Ver justificativa da IA
                  </span>
                  <span className="hidden group-open:inline">
                    Ocultar justificativa da IA
                  </span>
                </summary>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {result.pestTypeReasoning}
                </p>
              </details>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-2">
        <Button variant="default" size="sm" asChild>
          <Link href={`/analyses/${result.analysisId}`}>
            Ver detalhes
            <RiArrowRightLine />
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RiRefreshLine />
          Analisar outra imagem
        </Button>
      </CardFooter>
    </Card>
  );
}