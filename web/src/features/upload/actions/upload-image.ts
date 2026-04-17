"use server";

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/shared/db/client";
import { analyses, fields } from "@/shared/db/schema";
import { eq } from "drizzle-orm";
import { atomicWrite, checkDiskSpace, guardPath } from "@/shared/lib/fs-safe";
import { sha256Hex } from "@/shared/lib/hash";
import { env } from "@/shared/lib/env";
import type { ActionErrorCode, ActionResult } from "@/shared/lib/errors";

const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/bmp": "bmp",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

function resolveMimeType(file: File): string {
  if (file.type && ALLOWED_MIME[file.type]) return file.type;
  // Browsers may omit File.type on drag-and-drop — infer from extension
  const dot = file.name.lastIndexOf(".");
  if (dot !== -1) {
    const ext = file.name.slice(dot).toLowerCase();
    return EXT_TO_MIME[ext] ?? "";
  }
  return file.type;
}

export type UploadResult = {
  analysisId: string;
  severity: string;
  severityLabelPt: string;
  affectedPct: number;
  pestType: string;
  duplicate: boolean;
  capturedAt: number;
};

type ApiResponse = {
  request_id: string;
  severity: string;
  severity_label_pt: string;
  affected_pct: number;
  leaf_pixels: number;
  diseased_pixels: number;
  bounding_boxes?: Array<{ x: number; y: number; w: number; h: number; area_px: number }>;
  processing_ms?: number;
  api_version?: string;
  warnings?: string[];
};

type ApiErrorResponse = {
  request_id?: string;
  error?: {
    code?: string;
    message?: string;
    message_pt?: string;
  };
};

export async function uploadImage(
  formData: FormData,
): Promise<ActionResult<UploadResult>> {
  try {
    const file = formData.get("image") as File | null;
    const clientRequestId = formData.get("requestId") as string | null;
    const pestType =
      (formData.get("pestType") as string | null) ?? "nao_identificado";
    const fieldId = formData.get("fieldId") as string | null;

    if (!file || !clientRequestId) {
      return {
        success: false,
        error: { code: "INTERNAL", message: "Missing required fields" },
      };
    }

    // 1. Disk space check
    await checkDiskSpace(env.UPLOADS_DIR);

    // 2. Size check
    if (file.size > 8 * 1024 * 1024) {
      return {
        success: false,
        error: { code: "IMAGE_TOO_LARGE", message: "File too large" },
      };
    }

    // 3. Read bytes + compute SHA-256
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = sha256Hex(bytes);

    // 4. Dedup check
    const existing = db
      .select()
      .from(analyses)
      .where(eq(analyses.imageSha256, sha256))
      .get();
    if (existing) {
      return {
        success: true,
        data: {
          analysisId: existing.id,
          severity: existing.severity,
          severityLabelPt: existing.severityLabelPt,
          affectedPct: existing.affectedPct,
          pestType: existing.pestType,
          duplicate: true,
          capturedAt: Number(existing.capturedAt),
        },
      };
    }

    // 5. Determine extension from MIME (infer from filename if browser omitted type)
    const mimeType = resolveMimeType(file);
    const ext = ALLOWED_MIME[mimeType];
    if (!ext) {
      return {
        success: false,
        error: { code: "INVALID_MIME", message: "Unsupported file type" },
      };
    }

    // 6. Atomic write original
    const originalDir = path.join(env.UPLOADS_DIR, "original");
    const originalPath = path.join(originalDir, `${sha256}.${ext}`);
    guardPath(env.UPLOADS_DIR, originalPath);
    fs.mkdirSync(originalDir, { recursive: true });
    await atomicWrite(originalPath, bytes);

    // 7. Thumbnail via sharp (dynamic import — avoids SSR issues)
    let thumbPath: string | null = null;
    try {
      const sharp = (await import("sharp")).default;
      const thumbDir = path.join(env.UPLOADS_DIR, "thumbs");
      fs.mkdirSync(thumbDir, { recursive: true });
      const thumbFilePath = path.join(thumbDir, `${sha256}.webp`);
      guardPath(env.UPLOADS_DIR, thumbFilePath);
      await sharp(bytes)
        .resize(320, 320, { fit: "inside", withoutEnlargement: true })
        .rotate()
        .webp({ quality: 80 })
        .toFile(thumbFilePath);
      thumbPath = thumbFilePath;
    } catch {
      // Thumbnail failure is non-fatal — continue without thumb
    }

    // 8. Call FastAPI /analyze
    const apiFormData = new FormData();
    apiFormData.append(
      "image",
      new Blob([bytes], { type: mimeType }),
      file.name,
    );
    apiFormData.append("request_id", clientRequestId);

    let apiResult: ApiResponse;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);
      const apiRes = await fetch(`${env.API_BASE_URL}/analyze`, {
        method: "POST",
        body: apiFormData,
        signal: controller.signal,
        headers: { "X-Request-Id": clientRequestId },
      });
      clearTimeout(timeoutId);

      const json = (await apiRes.json()) as ApiResponse | ApiErrorResponse;

      if (!apiRes.ok) {
        const errJson = json as ApiErrorResponse;
        const code = errJson?.error?.code;
        const errorMap: Record<string, ActionErrorCode> = {
          IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
          INVALID_MIME: "INVALID_MIME",
          DECODE_FAILED: "DECODE_FAILED",
          TIMEOUT: "TIMEOUT",
        };
        const mappedCode: ActionErrorCode =
          (code && errorMap[code]) ? errorMap[code] : "INTERNAL";
        // Clean up written file on API failure
        try {
          fs.unlinkSync(originalPath);
        } catch {
          // ignore cleanup error
        }
        return {
          success: false,
          error: {
            code: mappedCode,
            message: errJson?.error?.message ?? "API error",
          },
        };
      }
      apiResult = json as ApiResponse;
    } catch (err: unknown) {
      try {
        fs.unlinkSync(originalPath);
      } catch {
        // ignore cleanup error
      }
      if (err instanceof Error && err.name === "AbortError") {
        return {
          success: false,
          error: { code: "TIMEOUT", message: "API timeout" },
        };
      }
      return {
        success: false,
        error: { code: "API_UNAVAILABLE", message: "API unreachable" },
      };
    }

    // 9. Resolve fieldId — use provided or fall back to first field in DB
    let resolvedFieldId = fieldId;
    if (!resolvedFieldId) {
      const firstField = db
        .select({ id: fields.id })
        .from(fields)
        .limit(1)
        .get();
      resolvedFieldId = firstField?.id ?? null;
    }
    if (!resolvedFieldId) {
      try {
        fs.unlinkSync(originalPath);
      } catch {
        // ignore cleanup error
      }
      return {
        success: false,
        error: { code: "INTERNAL", message: "No fields configured" },
      };
    }

    // 10. Annotated path (FastAPI writes this using request_id as filename)
    const annotatedPath = path.join(
      env.UPLOADS_DIR,
      "annotated",
      `${clientRequestId}.${ext}`,
    );

    // 11. INSERT analysis row
    const now = Date.now();
    const analysisId = randomUUID();
    try {
      db.insert(analyses)
        .values({
          id: analysisId,
          requestId: clientRequestId,
          imageSha256: sha256,
          source: "upload",
          fieldId: resolvedFieldId,
          pestType,
          severity: apiResult.severity,
          severityLabelPt: apiResult.severity_label_pt,
          affectedPct: apiResult.affected_pct,
          leafPixels: apiResult.leaf_pixels,
          diseasedPixels: apiResult.diseased_pixels,
          originalPath,
          annotatedPath,
          thumbnailPath: thumbPath,
          warnings:
            apiResult.warnings && apiResult.warnings.length > 0
              ? JSON.stringify(apiResult.warnings)
              : null,
          capturedAt: new Date(now),
          createdAt: new Date(now),
        })
        .run();
    } catch {
      // Unique constraint on requestId or imageSha256 — idempotency: return existing
      const dup = db
        .select()
        .from(analyses)
        .where(eq(analyses.imageSha256, sha256))
        .get();
      if (dup) {
        return {
          success: true,
          data: {
            analysisId: dup.id,
            severity: dup.severity,
            severityLabelPt: dup.severityLabelPt,
            affectedPct: dup.affectedPct,
            pestType: dup.pestType,
            duplicate: true,
            capturedAt: Number(dup.capturedAt),
          },
        };
      }
      return {
        success: false,
        error: { code: "INTERNAL", message: "DB error" },
      };
    }

    // 12. Revalidate caches
    revalidatePath("/");
    revalidatePath("/upload");
    revalidateTag("analyses-kpi", "max");
    revalidateTag("analyses-timeseries", "max");
    revalidateTag("analyses-gallery", "max");

    return {
      success: true,
      data: {
        analysisId,
        severity: apiResult.severity,
        severityLabelPt: apiResult.severity_label_pt,
        affectedPct: apiResult.affected_pct,
        pestType,
        duplicate: false,
        capturedAt: now,
      },
    };
  } catch (err) {
    console.error("[uploadImage]", err);
    return {
      success: false,
      error: { code: "INTERNAL", message: "Unexpected error" },
    };
  }
}
