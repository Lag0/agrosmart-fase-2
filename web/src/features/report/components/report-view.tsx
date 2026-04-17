import {
  RiDownload2Line,
  RiFileList3Line,
  RiSparklingLine,
} from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPestTypeLabel,
  formatReportDate,
  periodStartLabel,
  type ReportData,
} from "@/features/report/lib/report-data";

export function ReportView({ data }: { data: ReportData }) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <RiFileList3Line className="size-5" />
              Relatório operacional
            </CardTitle>
            <p className="text-muted-foreground mt-2 text-sm">
              Período: {periodStartLabel(data.generatedAt)} até{" "}
              {formatReportDate(data.generatedAt)} ({data.periodLabel})
            </p>
          </div>

          <Button asChild>
            <a href="/api/report/pdf" download>
              <RiDownload2Line className="size-4" />
              Exportar PDF
            </a>
          </Button>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total de análises" value={data.kpis.total.toString()} />
        <KpiCard
          title="Média de área afetada"
          value={`${data.kpis.avgAffectedPct.toFixed(1)}%`}
        />
        <KpiCard
          title="Saudáveis"
          value={`${data.kpis.healthyPct.toFixed(1)}%`}
        />
        <KpiCard
          title="Doentes"
          value={`${data.kpis.diseasedPct.toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-7">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle>Distribuição por tipo de praga</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topPests.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Sem dados no período.
                </p>
              ) : (
                data.topPests.map((item) => (
                  <div key={item.pestType} className="rounded-2xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">
                        {formatPestTypeLabel(item.pestType)}
                      </p>
                      <Badge variant="secondary">{item.count} análises</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Área média afetada: {item.avgAffectedPct.toFixed(1)}%
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Resumo dos últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Análises:</span>{" "}
              {data.trend.last7Total}
            </p>
            <p>
              <span className="text-muted-foreground">Doentes:</span>{" "}
              {data.trend.last7Diseased}
            </p>
            <p>
              <span className="text-muted-foreground">
                Taxa de severidade alta:
              </span>{" "}
              {data.trend.last7DiseasedPct.toFixed(1)}%
            </p>
            <p>
              <span className="text-muted-foreground">
                Tipos de praga distintos:
              </span>{" "}
              {data.kpis.pestTypes}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RiSparklingLine className="size-5" />
            Recomendação consolidada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed">
            {data.recommendation.content}
          </p>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Fonte: {data.recommendation.source}</Badge>
            <Badge variant="outline">Modelo: {data.recommendation.model}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas análises incluídas no relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Fazenda / Talhão</th>
                  <th className="px-2 py-2 font-medium">Severidade</th>
                  <th className="px-2 py-2 font-medium">Área afetada</th>
                  <th className="px-2 py-2 font-medium">Praga (manual)</th>
                  <th className="px-2 py-2 font-medium">Praga (IA)</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAnalyses.map((item) => (
                  <tr key={item.id} className="border-b last:border-none">
                    <td className="px-2 py-2 whitespace-nowrap">
                      {formatReportDate(item.capturedAt)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {item.farmName} · {item.fieldName}
                    </td>
                    <td className="px-2 py-2">{item.severityLabelPt}</td>
                    <td className="px-2 py-2">
                      {item.affectedPct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2">
                      {formatPestTypeLabel(item.pestType)}
                    </td>
                    <td className="px-2 py-2">
                      {formatPestTypeLabel(
                        item.pestTypeAi ?? "nao_identificado",
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-muted-foreground text-xs">{title}</p>
        <p className="font-heading mt-1 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
