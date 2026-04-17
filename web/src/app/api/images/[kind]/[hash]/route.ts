import { NextRequest, NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { env } from "@/shared/lib/env";
import { guardPath } from "@/shared/lib/fs-safe";

const VALID_KIND = new Set(["original", "annotated", "thumbs"]);

// hex sha256 (64 chars) OR seed/request-id filename stems (alphanumeric + _ -)
const HASH_RE = /^[a-f0-9]{64}$|^[a-zA-Z0-9_-]{1,80}$/;

const MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; hash: string }> },
) {
  const { kind, hash } = await params;

  // 1. Validate kind
  if (!VALID_KIND.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  // 2. Validate hash — reject path separators / dots beyond filename stem
  if (!HASH_RE.test(hash)) {
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
  }

  // 3. Find the file — try each allowed extension in preference order
  const exts = [".jpg", ".webp", ".png", ".bmp"];
  let filePath: string | null = null;

  for (const ext of exts) {
    const candidate = path.join(env.UPLOADS_DIR, kind, `${hash}${ext}`);
    try {
      guardPath(env.UPLOADS_DIR, candidate);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 400 });
    }
    if (fs.existsSync(candidate)) {
      filePath = candidate;
      break;
    }
  }

  if (!filePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 4. Serve with immutable cache headers (content-addressed — safe forever)
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] ?? "application/octet-stream";
  const fileBuffer = fs.readFileSync(filePath);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"sha256-${hash}"`,
    },
  });
}
