/**
 * Build image URLs from hashes / request IDs.
 * Components must use these helpers — never construct raw /api/images paths inline.
 */

export function thumbnailUrl(sha256: string): string {
  return `/api/images/thumbs/${sha256}`;
}

export function originalUrl(sha256OrRequestId: string): string {
  return `/api/images/original/${sha256OrRequestId}`;
}

export function annotatedUrl(sha256OrRequestId: string): string {
  return `/api/images/annotated/${sha256OrRequestId}`;
}
