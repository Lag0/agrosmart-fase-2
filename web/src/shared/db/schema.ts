import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const farms = sqliteTable(
  "farms",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    farmNameIdx: uniqueIndex("farms_name_idx").on(table.name),
  }),
);

export const fields = sqliteTable(
  "fields",
  {
    id: text("id").primaryKey(),
    farmId: text("farm_id")
      .notNull()
      .references(() => farms.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    fieldsFarmIdx: index("fields_farm_idx").on(table.farmId),
  }),
);

export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull().unique(),
    imageSha256: text("image_sha256").notNull().unique(),
    source: text("source").notNull().default("upload"),
    fieldId: text("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "restrict" }),
    pestType: text("pest_type").notNull().default("nao_identificado"),
    severity: text("severity").notNull(),
    severityLabelPt: text("severity_label_pt").notNull(),
    affectedPct: real("affected_pct").notNull(),
    leafPixels: integer("leaf_pixels").notNull(),
    diseasedPixels: integer("diseased_pixels").notNull(),
    originalPath: text("original_path"),
    annotatedPath: text("annotated_path"),
    thumbnailPath: text("thumbnail_path"),
    warnings: text("warnings"),
    capturedAt: integer("captured_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    analysesFieldCapturedIdx: index("analyses_field_captured_idx").on(
      table.fieldId,
      table.capturedAt,
    ),
    analysesCapturedIdx: index("analyses_captured_idx").on(table.capturedAt),
    analysesSeverityIdx: index("analyses_severity_idx").on(table.severity),
    analysesPestCapturedIdx: index("analyses_pest_captured_idx").on(
      table.pestType,
      table.capturedAt,
    ),
    analysesShaIdx: uniqueIndex("analyses_sha_idx").on(table.imageSha256),
    analysesRequestIdx: uniqueIndex("analyses_request_idx").on(table.requestId),
  }),
);

export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    model: text("model").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    recommendationsAnalysisIdx: index("recommendations_analysis_idx").on(
      table.analysisId,
    ),
  }),
);

export const llmCache = sqliteTable("llm_cache", {
  key: text("key").primaryKey(),
  text: text("text").notNull(),
  model: text("model").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const uploadsAudit = sqliteTable("uploads_audit", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  ipHash: text("ip_hash").notNull(),
  uaHash: text("ua_hash").notNull(),
  sha256: text("sha256").notNull(),
  bytes: integer("bytes").notNull(),
  sniffedMime: text("sniffed_mime").notNull(),
  result: text("result").notNull(),
  errorCode: text("error_code"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
