import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// pg removes a failed idle client before emitting this event. Without a
// listener, Node treats it as an uncaught error and terminates the API process.
// Leave reconnection to the pool; never retry a potentially committed write.
pool.on("error", (error: Error & { code?: string }) => {
  // Log only a diagnostic code, not connection details or query contents.
  process.stderr.write(`${JSON.stringify({
    level: "error",
    event: "database_pool_idle_error",
    code: error.code ?? "UNKNOWN",
    message: "Idle database connection failed and was removed from the pool",
  })}\n`);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
