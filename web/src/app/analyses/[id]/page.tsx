import * as fs from "node:fs";
import * as path from "node:path";
import {
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiLeafLine,
  RiRobot2Line,
  RiScanLine,
} from "@remixicon/react";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarInset } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { annotatedUrl, originalUrl } from "@/features/gallery/lib/image-paths";
import { db } from "@/shared/db/client";
import { analyses, farms, fields } from "@/shared/db/schema";
import {
  confidenceColor,
  formatConfidence,
  formatPestLabel,
  formatSeverityLabel,
  SEVERITY_COLORS,
} from "@/shared/lib/format";

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card size="sm" className="gap-3">
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-xs">{label}</p>
        <div className="text-base font-medium">{value}</div>
        {hint ? (
          <div className="text-muted-foreground text-xs">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const row = db
    .select({
      id: analyses.id,
      requestId: analyses.requestId,
      imageSha256: analyses.imageSha256,
      severity: analyses.severity,
      severityLabelPt: analyses.severityLabelPt,
      affectedPct: analyses.affectedPct,
      leafPixels: analyses.leafPixels,
      diseasedPixels: analyses.diseasedPixels,
      pestType: analyses.pestType,
      pestTypeAi: analyses.pestTypeAi,
      pestTypeConfidence: analyses.pestTypeConfidence,
      pestTypeReasoning: analyses.pestTypeReasoning,
      pestTypeModel: analyses.pestTypeModel,
      warnings: analyses.warnings,
      annotatedPath: analyses.annotatedPath,
      originalPath: analyses.originalPath,
      thumbnailPath: analyses.thumbnailPath,
      capturedAt: analyses.capturedAt,
      createdAt: analyses.createdAt,
      fieldName: fields.name,
      farmName: farms.name,
    })
    .from(analyses)
    .innerJoin(fields, eq(analyses.fieldId, fields.id))
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .where(eq(analyses.id, id))
    .get();

  if (!row) {
    notFound();
  }

  const hasOriginal =
    row.originalPath != null && fs.existsSync(row.originalPath);
  const hasAnnotated =
    row.annotatedPath != null && fs.existsSync(row.annotatedPath);

  const originalStem = row.originalPath
    ? path.parse(row.originalPath).name
    : row.imageSha256;
  const annotatedStem = row.annotatedPath
    ? path.parse(row.annotatedPath).name
    : row.requestId;

  const originalImageUrl = hasOriginal ? originalUrl(originalStem) : null;
  const annotatedImageUrl = hasAnnotated ? annotatedUrl(annotatedStem) : null;
  const defaultImageTab = annotatedImageUrl ? "annotated" : "original";

  const warnings: string[] = row.warnings ? JSON.parse(row.warnings) : [];
  const showAiCard = row.pestTypeAi != null;

  return (
    <SidebarInset>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-6 pb-20 md:pb-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/">
                <RiArrowLeftLine />
                Voltar ao dashboard
              </Link>
            </Button>
            <Badge
              className={
                SEVERITY_COLORS[row.severity] ??
                "bg-muted text-muted-foreground"
              }
            >
              {row.severityLabelPt}
            </Badge>
            <Badge variant="outline">{formatPestLabel(row.pestType)}</Badge>
            <span className="text-muted-foreground text-sm">
              {row.farmName} · {row.fieldName}
            </span>
          </div>

          <div className="space-y-2">
            <h1>Detalhe da análise</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Resultado completo da análise de imagem com severidade, tipo de
              praga, comparação entre imagem original e anotada, além dos
              metadados salvos no banco.
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
          <Card className="gap-0 overflow-hidden">
            <CardHeader className="border-b">
              <CardTitle>Inspeção visual</CardTitle>
              <CardDescription>
                Compare a imagem original com a versão anotada gerada pela API.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue={defaultImageTab} className="gap-0">
                <div className="border-b px-6 py-4">
                  <TabsList>
                    <TabsTrigger
                      value="annotated"
                      disabled={!annotatedImageUrl}
                    >
                      Anotada
                    </TabsTrigger>
                    <TabsTrigger value="original" disabled={!originalImageUrl}>
                      Original
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="annotated" className="m-0">
                  {annotatedImageUrl ? (
                    <div className="bg-muted/20">
                      <img
                        src={annotatedImageUrl}
                        alt="Imagem anotada com áreas detectadas"
                        className="max-h-[760px] w-full object-contain"
                        loading="eager"
                      />
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex min-h-[420px] items-center justify-center p-6 text-sm">
                      Não há imagem anotada disponível para esta análise.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="original" className="m-0">
                  {originalImageUrl ? (
                    <div className="bg-muted/20">
                      <img
                        src={originalImageUrl}
                        alt="Imagem original enviada"
                        className="max-h-[760px] w-full object-contain"
                        loading="eager"
                      />
                    </div>
                  ) : (
                    <div className="text-muted-foreground flex min-h-[420px] items-center justify-center p-6 text-sm">
                      Não há imagem original disponível para esta análise.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumo da análise</CardTitle>
                <CardDescription>
                  Leitura consolidada para tomada de decisão rápida.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <MetricCard
                  label="Severidade"
                  value={
                    <Badge
                      className={
                        SEVERITY_COLORS[row.severity] ??
                        "bg-muted text-muted-foreground"
                      }
                    >
                      {row.severityLabelPt}
                    </Badge>
                  }
                />
                <MetricCard
                  label="Área afetada"
                  value={
                    <span className="font-heading text-3xl font-bold tracking-tight">
                      {row.affectedPct.toFixed(1)}%
                    </span>
                  }
                />
                <MetricCard
                  label="Tipo principal"
                  value={formatPestLabel(row.pestType)}
                  hint="Valor final salvo na análise"
                />
                <MetricCard
                  label="Folha detectada"
                  value={
                    <span>{row.leafPixels.toLocaleString("pt-BR")} px</span>
                  }
                />
                <MetricCard
                  label="Pixels suspeitos"
                  value={
                    <span>{row.diseasedPixels.toLocaleString("pt-BR")} px</span>
                  }
                />
                <MetricCard
                  label="Talhão / Fazenda"
                  value={`${row.fieldName} · ${row.farmName}`}
                />
              </CardContent>
            </Card>

            {showAiCard ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RiRobot2Line className="size-5" />
                    Classificação por IA
                  </CardTitle>
                  <CardDescription>
                    Sugestão do modelo visual usada como apoio à classificação.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={confidenceColor(row.pestTypeConfidence)}
                    >
                      {formatPestLabel(row.pestTypeAi)} •{" "}
                      {formatConfidence(row.pestTypeConfidence)}
                    </Badge>
                    {row.pestTypeModel ? (
                      <span className="text-muted-foreground text-xs">
                        {row.pestTypeModel}
                      </span>
                    ) : null}
                  </div>

                  {row.pestTypeReasoning ? (
                    <div className="rounded-3xl border bg-muted/20 p-4">
                      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                        Justificativa
                      </p>
                      <p className="text-sm leading-6">
                        {row.pestTypeReasoning}
                      </p>
                    </div>
                  ) : null}

                  {(row.pestTypeConfidence ?? 0) < 0.4 ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                      A IA não tem alta confiança. Use este resultado como apoio
                      visual, não como decisão final isolada.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {warnings.includes("NO_LEAF_DETECTED") ? (
              <Card className="border-yellow-200 bg-yellow-50/80 dark:border-yellow-900/40 dark:bg-yellow-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                    <RiLeafLine className="size-5" />
                    Aviso da análise
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Não identificamos folha na imagem. O resultado pode estar
                    impreciso.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RiScanLine className="size-5" />
                  Metadados
                </CardTitle>
                <CardDescription>
                  Informações técnicas persistidas para rastreabilidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      Capturado em
                    </p>
                    <p className="font-medium">
                      {formatTimestamp(Number(row.capturedAt))}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Criado em</p>
                    <p className="font-medium">
                      {formatTimestamp(Number(row.createdAt))}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3 break-all">
                  <div>
                    <p className="text-muted-foreground text-xs">Analysis ID</p>
                    <p className="font-mono text-xs">{row.id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Request ID</p>
                    <p className="font-mono text-xs">{row.requestId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">
                      SHA-256 da imagem
                    </p>
                    <p className="font-mono text-xs">{row.imageSha256}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <RiCheckboxCircleLine className="size-4 text-emerald-600" />
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Arquivos disponíveis
                      </p>
                    </div>
                    <ul className="space-y-1 text-sm">
                      <li>Original: {hasOriginal ? "sim" : "não"}</li>
                      <li>Anotada: {hasAnnotated ? "sim" : "não"}</li>
                      <li>Thumbnail: {row.thumbnailPath ? "sim" : "não"}</li>
                    </ul>
                  </div>
                  <div className="rounded-3xl border bg-muted/20 p-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Observações
                    </p>
                    <p className="text-sm">
                      {warnings.length > 0
                        ? warnings.join(", ")
                        : "Nenhum warning registrado nesta análise."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}