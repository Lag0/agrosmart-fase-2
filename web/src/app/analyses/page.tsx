import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiEyeLine,
  RiImageLine,
  RiLeafLine,
} from "@remixicon/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SidebarInset } from "@/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { thumbnailUrl } from "@/features/gallery/lib/image-paths";
import {
  type AnalysisListItem,
  getAnalysesPage,
} from "@/shared/db/queries/analyses-list";

const SEVERITY_COLORS: Record<string, string> = {
  healthy:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  beginning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  diseased: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PEST_LABELS: Record<string, string> = {
  ferrugem: "Ferrugem",
  mancha_parda: "Mancha Parda",
  oidio: "Oídio",
  lagarta: "Lagarta",
  outro: "Outro",
  nao_identificado: "Não identificado",
};

function formatPestType(value: string | null): string {
  if (!value) return "Não identificado";
  return PEST_LABELS[value] ?? value.replace(/_/g, " ");
}

function getDisplayPestType(item: AnalysisListItem): string {
  if (item.pestType !== "nao_identificado") {
    return item.pestType;
  }

  if (item.pestTypeAi && item.pestTypeAi !== "nao_identificado") {
    return item.pestTypeAi;
  }

  return item.pestType;
}

function formatCapturedAt(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function buildPageHref(page: number): string {
  return page <= 1 ? "/analyses" : `/analyses?page=${page}`;
}

export default async function AnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const currentPage = Math.max(
    1,
    Number(resolvedSearchParams.page ?? "1") || 1,
  );
  const { items, page, total, totalPages } = await getAnalysesPage(
    currentPage,
    12,
  );

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
            <Badge variant="outline">{total} análises</Badge>
          </div>

          <div className="space-y-2">
            <h1>Todas as análises</h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              Lista completa das análises processadas, com acesso rápido aos
              detalhes, severidade detectada, tipo principal de praga e
              metadados do campo.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RiLeafLine className="size-5" />
                Nenhuma análise encontrada
              </CardTitle>
              <CardDescription>
                Faça um upload para começar a alimentar o histórico da
                plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/upload">Ir para upload</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="hidden md:flex">
              <CardHeader>
                <CardTitle>Histórico completo</CardTitle>
                <CardDescription>
                  Ordenado das análises mais recentes para as mais antigas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Tipo principal</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Área afetada</TableHead>
                      <TableHead>Talhão / Fazenda</TableHead>
                      <TableHead>Capturado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const displayPestType = getDisplayPestType(item);

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
                                {item.thumbnailPath ? (
                                  <img
                                    src={thumbnailUrl(item.imageSha256)}
                                    alt={formatPestType(displayPestType)}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <RiImageLine className="size-5 text-muted-foreground/50" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {item.requestId}
                                </p>
                                <p className="text-muted-foreground truncate text-xs">
                                  {item.id}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {formatPestType(displayPestType)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                SEVERITY_COLORS[item.severity] ??
                                "bg-muted text-muted-foreground"
                              }
                            >
                              {item.severityLabelPt}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-heading text-xl font-bold tracking-tight">
                              {item.affectedPct.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.fieldName} · {item.farmName}
                          </TableCell>
                          <TableCell>
                            {formatCapturedAt(item.capturedAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/analyses/${item.id}`}>
                                <RiEyeLine />
                                Ver detalhe
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:hidden">
              {items.map((item) => {
                const displayPestType = getDisplayPestType(item);

                return (
                  <Card key={item.id} size="sm">
                    <CardContent className="flex gap-4">
                      <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border bg-muted">
                        {item.thumbnailPath ? (
                          <img
                            src={thumbnailUrl(item.imageSha256)}
                            alt={formatPestType(displayPestType)}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <RiImageLine className="size-6 text-muted-foreground/50" />
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              SEVERITY_COLORS[item.severity] ??
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {item.severityLabelPt}
                          </Badge>
                          <Badge variant="outline">
                            {formatPestType(displayPestType)}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <p className="font-heading text-3xl font-bold tracking-tight">
                            {item.affectedPct.toFixed(1)}%
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {item.fieldName} · {item.farmName}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {formatCapturedAt(item.capturedAt)}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full"
                        >
                          <Link href={`/analyses/${item.id}`}>
                            <RiEyeLine />
                            Ver detalhe
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card size="sm">
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground text-sm">
                  Página {page} de {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={page <= 1}
                  >
                    <Link
                      href={buildPageHref(page - 1)}
                      aria-disabled={page <= 1}
                    >
                      <RiArrowLeftLine />
                      Anterior
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={page >= totalPages}
                  >
                    <Link
                      href={buildPageHref(page + 1)}
                      aria-disabled={page >= totalPages}
                    >
                      Próxima
                      <RiArrowRightLine />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SidebarInset>
  );
}
