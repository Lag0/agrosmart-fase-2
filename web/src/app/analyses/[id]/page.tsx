import { notFound } from "next/navigation";
import * as fs from "node:fs";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { SidebarInset } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { db } from "@/shared/db/client";
import { analyses, fields, farms } from "@/shared/db/schema";
import { annotatedUrl, originalUrl } from "@/features/gallery/lib/image-paths";

interface Props {
  params: { id: string };
}

const SEVERITY_COLORS: Record<string, string> = {
  healthy: "bg-green-100 text-green-800",
  beginning: "bg-yellow-100 text-yellow-800",
  diseased: "bg-red-100 text-red-800",
};

export default async function AnalysisDetailPage({ params }: Props) {
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
      warnings: analyses.warnings,
      annotatedPath: analyses.annotatedPath,
      originalPath: analyses.originalPath,
      thumbnailPath: analyses.thumbnailPath,
      capturedAt: analyses.capturedAt,
      fieldName: fields.name,
      farmName: farms.name,
    })
    .from(analyses)
    .innerJoin(fields, eq(analyses.fieldId, fields.id))
    .innerJoin(farms, eq(fields.farmId, farms.id))
    .where(eq(analyses.id, params.id))
    .get();

  if (!row) notFound();

  const hasAnnotated =
    row.annotatedPath != null && fs.existsSync(row.annotatedPath);

  const imageUrl = hasAnnotated
    ? annotatedUrl(row.requestId)
    : originalUrl(row.imageSha256);

  const warnings: string[] = row.warnings ? JSON.parse(row.warnings) : [];

  const capturedDate = new Date(Number(row.capturedAt)).toLocaleString(
    "pt-BR",
    { timeZone: "America/Sao_Paulo" },
  );

  return (
    <SidebarInset>
      <div className="flex flex-1 flex-col gap-6 p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Voltar
          </Link>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Detalhe da análise
          </h1>
        </div>

        {/* Image */}
        <div className="rounded-xl overflow-hidden border bg-muted max-w-lg">
          <img
            src={imageUrl}
            alt="Imagem analisada"
            className="w-full object-contain"
            loading="eager"
          />
        </div>

        {/* Severity + metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border p-4">
            <p className="text-muted-foreground text-xs mb-1.5">Severidade</p>
            <Badge
              className={
                SEVERITY_COLORS[row.severity] ??
                "bg-muted text-muted-foreground"
              }
            >
              {row.severityLabelPt}
            </Badge>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Área afetada</p>
            <p className="font-heading text-xl font-bold">
              {row.affectedPct.toFixed(1)}%
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Praga</p>
            <p className="text-sm font-medium capitalize">
              {row.pestType.replace(/_/g, " ")}
            </p>
          </div>
          <div className="rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Talhão / Fazenda</p>
            <p className="text-sm font-medium">
              {row.fieldName} · {row.farmName}
            </p>
          </div>
        </div>

        {/* Warnings */}
        {warnings.includes("NO_LEAF_DETECTED") && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            ⚠️ Não identificamos folha na imagem. O resultado pode ser
            impreciso.
          </div>
        )}

        {/* Meta */}
        <div className="text-muted-foreground text-xs">
          Capturado em {capturedDate} · ID: {row.id}
        </div>
      </div>
    </SidebarInset>
  );
}
