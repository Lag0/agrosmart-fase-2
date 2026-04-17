/**
 * Single source of truth for pest type definitions.
 *
 * Every component MUST import from here instead of defining local maps.
 * The `value` field matches the DB enum and VLM output exactly.
 */

export const PEST_TYPES = [
  { value: "nao_identificado", label: "Não identificado", short: "Não identif.", color: "var(--muted-foreground)" },
  { value: "ferrugem", label: "Ferrugem", short: "Ferrugem", color: "var(--chart-1)" },
  { value: "mancha_parda", label: "Mancha Parda", short: "Mancha parda", color: "var(--chart-2)" },
  { value: "oidio", label: "Oídio", short: "Oídio", color: "var(--chart-3)" },
  { value: "lagarta", label: "Lagarta", short: "Lagarta", color: "var(--chart-4)" },
  { value: "outro", label: "Outro", short: "Outro", color: "var(--chart-5)" },
] as const;

export type PestTypeValue = (typeof PEST_TYPES)[number]["value"];

const PEST_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map((p) => [p.value, p.label]),
);

const PEST_SHORT_MAP: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map((p) => [p.value, p.short]),
);

/** Full label: "Mancha Parda", "Não identificado", etc. */
export function formatPestLabel(pestType: string | null | undefined): string {
  if (!pestType) return "Não identificado";
  return PEST_LABEL_MAP[pestType] ?? pestType.replace(/_/g, " ");
}

/** Short label: "Mancha parda", "Não identif.", etc. */
export function formatPestShort(pestType: string | null | undefined): string {
  if (!pestType) return "Não identif.";
  return PEST_SHORT_MAP[pestType] ?? pestType.replace(/_/g, " ");
}

/** Resolve display pest type: prefers manual, falls back to AI, then raw. */
export function resolvePestDisplay(
  manual: string,
  ai: string | null,
): string {
  if (manual !== "nao_identificado") return manual;
  if (ai && ai !== "nao_identificado") return ai;
  return manual;
}

// ---------------------------------------------------------------------------
// Confidence display helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Severity helpers (shared across pages)
// ---------------------------------------------------------------------------

export const SEVERITY_COLORS: Record<string, string> = {
  healthy:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  beginning:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  diseased: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export function formatSeverityLabel(severity: string): string {
  switch (severity) {
    case "healthy":
      return "Saudável";
    case "beginning":
      return "Início";
    case "diseased":
      return "Doente";
    default:
      return severity;
  }
}