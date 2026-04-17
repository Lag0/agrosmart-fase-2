"use client";

import { RiArrowDownLine, RiArrowUpLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { KpiData } from "@/shared/db/queries/kpis";

interface SectionCardsProps {
  data: KpiData;
}

export function SectionCards({ data }: SectionCardsProps) {
  const cards = [
    {
      description: "Total de análises",
      value: data.total.toLocaleString("pt-BR"),
      badge: null,
      footer: "Últimos 30 dias de monitoramento",
    },
    {
      description: "Plantas saudáveis",
      value: `${data.healthyPct}%`,
      badge:
        data.healthyPct >= 50 ? (
          <Badge variant="outline" className="gap-1">
            <RiArrowDownLine className="size-3" />
            {data.healthyPct}%
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <RiArrowUpLine className="size-3" />
            {data.healthyPct}%
          </Badge>
        ),
      footer:
        data.healthyPct >= 50
          ? "Índice saudável estável"
          : "Índice saudável abaixo do ideal",
    },
    {
      description: "Plantas doentes",
      value: `${data.diseasedPct}%`,
      badge:
        data.diseasedPct <= 15 ? (
          <Badge variant="outline" className="gap-1">
            <RiArrowDownLine className="size-3" />
            {data.diseasedPct}%
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <RiArrowUpLine className="size-3" />
            {data.diseasedPct}%
          </Badge>
        ),
      footer:
        data.diseasedPct <= 15
          ? "Nível de doença controlado"
          : "Atenção: nível de doença elevado",
    },
    {
      description: "Tipos de praga",
      value: String(data.pestTypes),
      badge: null,
      footer: "Ferrugem, mancha parda, oídio, lagarta e outros",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.description} className="@container/card">
          <CardHeader>
            <CardDescription>{card.description}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {card.value}
            </CardTitle>
            {card.badge && <CardAction>{card.badge}</CardAction>}
          </CardHeader>
          <CardFooter>
            <div className="text-muted-foreground text-xs">
              {card.footer}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
