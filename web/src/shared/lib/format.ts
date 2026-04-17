export function formatConfidence(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const clamped = Math.min(Math.max(value, 0), 1);
  return `${Math.round(clamped * 100)}%`;
}

export function confidenceColor(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "bg-secondary text-secondary-foreground";
  }

  if (value >= 0.7) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  }

  if (value >= 0.4) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  }

  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

const PEST_LABELS: Record<string, string> = {
  nao_identificado: "Não identificado",
  ferrugem: "Ferrugem",
  mancha_parda: "Mancha Parda",
  oidio: "Oídio",
  lagarta: "Lagarta",
};

export function formatPestLabel(pestType: string | null | undefined): string {
  if (!pestType) return "Não identificado";
  return PEST_LABELS[pestType] ?? pestType.replace(/_/g, " ");
}
