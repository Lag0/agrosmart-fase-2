"use client";

import { RiLoader4Line, RiSparklingLine } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateRecommendation } from "../server/generate-recommendation";

export function GenerateRecommendationButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await generateRecommendation();

      if (!result.success) {
        toast.error(result.error.message);
        return;
      }

      toast.success(
        result.data.source === "cache"
          ? "Relatório recuperado do cache — nenhuma análise nova desde a última geração."
          : "Relatório gerado a partir das análises dos últimos 30 dias.",
      );
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending} variant="outline">
      {isPending ? (
        <RiLoader4Line className="size-4 animate-spin" />
      ) : (
        <RiSparklingLine className="size-4" />
      )}
      {isPending ? "Gerando…" : "Gerar com IA"}
    </Button>
  );
}
