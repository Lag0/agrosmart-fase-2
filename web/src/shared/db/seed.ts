import seedrandom from "seedrandom";
import { db, sqlite } from "./client";
import { analyses, farms, fields } from "./schema";

const SEED = process.env.SEED ?? "agrosmart-2026";
const rng = seedrandom(SEED);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 2): number {
  const val = min + rng() * (max - min);
  return Number.parseFloat(val.toFixed(decimals));
}

const PEST_TYPES = [
  "ferrugem",
  "mancha_parda",
  "oidio",
  "lagarta",
  "nao_identificado",
] as const;

type Severity = "healthy" | "beginning" | "diseased";

function classify(pct: number): Severity {
  if (pct < 5) return "healthy";
  if (pct < 15) return "beginning";
  return "diseased";
}

const SEVERITY_LABELS_PT: Record<Severity, string> = {
  healthy: "Planta saudável",
  beginning: "Possível início de doença",
  diseased: "Planta doente",
};

async function seed() {
  const now = Date.now();
  const DAY_MS = 86_400_000;

  // --- Farms ---
  const farmData = [
    { id: "seed:fazenda-alfa", name: "Fazenda Alfa" },
    { id: "seed:fazenda-beta", name: "Fazenda Beta" },
    { id: "seed:fazenda-gama", name: "Fazenda Gama" },
  ];

  for (const farm of farmData) {
    await db
      .insert(farms)
      .values({ ...farm, createdAt: new Date(now) })
      .onConflictDoNothing();
  }

  // --- Fields ---
  const fieldData = [
    { id: "seed:alfa-talhao-1", farmId: "seed:fazenda-alfa", name: "Talhão 1" },
    { id: "seed:alfa-talhao-2", farmId: "seed:fazenda-alfa", name: "Talhão 2" },
    { id: "seed:alfa-talhao-3", farmId: "seed:fazenda-alfa", name: "Talhão 3" },
    { id: "seed:beta-talhao-1", farmId: "seed:fazenda-beta", name: "Talhão 1" },
    { id: "seed:beta-talhao-2", farmId: "seed:fazenda-beta", name: "Talhão 2" },
    { id: "seed:gama-talhao-1", farmId: "seed:fazenda-gama", name: "Talhão 1" },
    { id: "seed:gama-talhao-2", farmId: "seed:fazenda-gama", name: "Talhão 2" },
  ];

  for (const field of fieldData) {
    await db
      .insert(fields)
      .values({ ...field, createdAt: new Date(now) })
      .onConflictDoNothing();
  }

  // --- Analyses (30 days of data) ---
  const allFieldIds = fieldData.map((f) => f.id);
  let analysisCount = 0;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const capturedAt = new Date(now - dayOffset * DAY_MS);
    const analysesPerDay = randInt(8, 18);

    for (let i = 0; i < analysesPerDay; i++) {
      analysisCount++;
      const fieldId = pick(allFieldIds);
      const pestType = pick(PEST_TYPES);
      const leafPixels = randInt(80_000, 500_000);

      // Weighted severity: ~60% healthy, ~25% beginning, ~15% diseased
      const severityRoll = rng();
      let affectedPct: number;
      if (severityRoll < 0.6) {
        affectedPct = randFloat(0, 4.9);
      } else if (severityRoll < 0.85) {
        affectedPct = randFloat(5, 14.9);
      } else {
        affectedPct = randFloat(15, 45);
      }

      const severity = classify(affectedPct);
      const diseasedPixels = Math.round(leafPixels * (affectedPct / 100));
      const n = String(analysisCount).padStart(4, "0");

      await db
        .insert(analyses)
        .values({
          id: `seed:analysis:${n}`,
          requestId: `seed:req:${n}`,
          imageSha256: `seed:sha:${n}`,
          source: "seed",
          fieldId,
          pestType,
          severity,
          severityLabelPt: SEVERITY_LABELS_PT[severity],
          affectedPct,
          leafPixels,
          diseasedPixels,
          capturedAt,
          createdAt: new Date(now),
        })
        .onConflictDoNothing();
    }
  }

  // --- Report ---
  const totalAnalyses = await db.select().from(analyses);
  const totalFarms = await db.select().from(farms);
  const totalFields = await db.select().from(fields);

  console.log(`✅ Seed complete (seed=${SEED})`);
  console.log(`   Farms:      ${totalFarms.length}`);
  console.log(`   Fields:     ${totalFields.length}`);
  console.log(`   Analyses:   ${totalAnalyses.length}`);

  sqlite.close();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
