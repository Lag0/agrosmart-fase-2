export type ActionErrorCode =
  | "API_UNAVAILABLE"
  | "IMAGE_TOO_LARGE"
  | "INVALID_MIME"
  | "DECODE_FAILED"
  | "NO_LEAF_DETECTED"
  | "DUPLICATE"
  | "RATE_LIMITED"
  | "DISK_FULL"
  | "TIMEOUT"
  | "INTERNAL";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ActionErrorCode; message: string } };
