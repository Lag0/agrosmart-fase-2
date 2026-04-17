"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GalleryItem } from "@/shared/db/queries/gallery";

const PEST_LABELS: Record<string, string> = {
  ferrugem: "Ferrugem",
  mancha_parda: "Mancha parda",
  oidio: "Oídio",
  lagarta: "Lagarta",
  nao_identificado: "Não identif.",
};

function severityColor(severity: string): string {
  switch (severity) {
    case "healthy":
      return "bg-chart-1/10 border-l-chart-1";
    case "beginning":
      return "bg-chart-2/10 border-l-chart-2";
    case "diseased":
      return "bg-destructive/10 border-l-destructive";
    default:
      return "bg-muted border-l-muted-foreground";
  }
}

function severityDot(severity: string): string {
  switch (severity) {
    case "healthy":
      return "bg-chart-1";
    case "beginning":
      return "bg-chart-2";
    case "diseased":
      return "bg-destructive";
    default:
      return "bg-muted-foreground";
  }
}

function relativeTime(timestampMs: number): string {
  const diff = Date.now() - timestampMs;
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(timestampMs).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

type GalleryStripProps = {
  items: GalleryItem[];
};

export function GalleryStrip({ items }: GalleryStripProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-lg font-semibold tracking-tight">
          Análises recentes
        </h3>
        <p className="text-muted-foreground text-sm">
          Últimas análises processadas
        </p>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/analyses/${item.id}`}
            className="group shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-3xl"
          >
            <Card className="w-[200px] overflow-hidden rounded-3xl transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <div
                className={cn(
                  "aspect-[4/3] flex items-center justify-center border-l-4 transition-colors",
                  severityColor(item.severity),
                )}
              >
                <span className="text-muted-foreground/40 text-3xl font-light">
                  #
                </span>
              </div>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="truncate text-base font-medium">
                    {PEST_LABELS[item.pestType] ?? item.pestType}
                  </span>
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      severityDot(item.severity),
                    )}
                  />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">
                    {item.affectedPct.toFixed(1)}%
                  </span>
                  <span className="text-muted-foreground text-sm font-medium">
                    {relativeTime(item.capturedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GalleryStripSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex gap-4 overflow-hidden pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[250px] w-[200px] shrink-0 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
