import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/shared/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH ?? "../data/agrosmart.db",
  },
  verbose: true,
  strict: true,
});
