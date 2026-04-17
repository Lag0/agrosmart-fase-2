import * as fs from "node:fs";
import { rename, unlink, writeFile } from "node:fs/promises";
import * as path from "node:path";

const MIN_FREE_BYTES = 500 * 1024 * 1024; // 500 MB

export async function checkDiskSpace(dir: string): Promise<void> {
  // Use fs.statfsSync (Node 19+) or fallback gracefully
  try {
    // statfsSync is available in Node 19+ / Bun
    const stats = (
      fs as unknown as {
        statfsSync: (p: string) => { bfree: number; bsize: number };
      }
    ).statfsSync(dir);
    const freeBytes = stats.bfree * stats.bsize;
    if (freeBytes < MIN_FREE_BYTES) {
      throw new Error("DISK_FULL");
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "DISK_FULL") throw e;
    // statfsSync not available on this platform — skip check silently
  }
}

export async function atomicWrite(
  destPath: string,
  data: Buffer | Uint8Array,
): Promise<void> {
  const tmpPath = `${destPath}.tmp`;
  try {
    await writeFile(tmpPath, data);
    await rename(tmpPath, destPath);
  } catch (err) {
    try {
      await unlink(tmpPath);
    } catch {
      // ignore cleanup error
    }
    throw err;
  }
}

export function guardPath(uploadsDir: string, resolvedPath: string): void {
  const normalized = path.resolve(resolvedPath);
  const base = path.resolve(uploadsDir);
  if (!normalized.startsWith(`${base}${path.sep}`) && normalized !== base) {
    throw new Error("PATH_TRAVERSAL");
  }
}
