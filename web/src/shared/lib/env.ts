export const env = {
  DB_PATH: process.env.DB_PATH ?? "../data/agrosmart.db",
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? "../data/uploads",
  API_BASE_URL: process.env.API_BASE_URL ?? "http://localhost:8000",
  UPLOAD_AUDIT_SALT: process.env.UPLOAD_AUDIT_SALT ?? "dev-salt",
  AGROSMART_PUBLIC_ORIGIN:
    process.env.AGROSMART_PUBLIC_ORIGIN ?? "http://localhost:3000",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
  OPENROUTER_BASE_URL:
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  OPENROUTER_MODEL:
    process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-flash-lite",
} as const;
