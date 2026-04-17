import { createHash, createHmac } from "node:crypto";

export function sha256Hex(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function hmacSha256Hex(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}
