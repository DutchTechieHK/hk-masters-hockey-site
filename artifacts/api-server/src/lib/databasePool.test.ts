import { afterAll, describe, expect, it, vi } from "vitest";
import { pool } from "@workspace/db";

afterAll(async () => {
  await pool.end();
});

describe("database pool idle connection failures", () => {
  it("handles a terminated idle client and serves the next query with a new connection", async () => {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    const log = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      const error = Object.assign(
        new Error("terminating connection due to administrator command"),
        { code: "57P01" },
      );

      // Simulate pg reporting a terminated connection after it was returned to
      // the idle pool, without issuing destructive SQL against the database.
      expect(() => client.emit("error", error)).not.toThrow();
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
        level: "error",
        event: "database_pool_idle_error",
        code: "57P01",
        message: "Idle database connection failed and was removed from the pool",
      });

      const replacement = await pool.connect();
      try {
        expect(replacement).not.toBe(client);
        expect((await replacement.query("SELECT 1 AS ok")).rows).toEqual([{ ok: 1 }]);
      } finally {
        replacement.release();
      }
    } finally {
      log.mockRestore();
    }
  });

  it("does not swallow errors from an active query", async () => {
    await expect(pool.query("SELECT 1 / 0")).rejects.toMatchObject({ code: "22012" });
    expect((await pool.query("SELECT 1 AS ok")).rows).toEqual([{ ok: 1 }]);
  });
});
