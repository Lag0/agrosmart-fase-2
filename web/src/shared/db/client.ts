import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(process.env.DB_PATH ?? "../data/agrosmart.db", {
  fileMustExist: false,
});

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("temp_store = MEMORY");
sqlite.pragma("mmap_size = 268435456");
sqlite.pragma("cache_size = -20000");

process.on("beforeExit", () => {
  sqlite.close();
});

export const db = drizzle(sqlite);
export { sqlite };
