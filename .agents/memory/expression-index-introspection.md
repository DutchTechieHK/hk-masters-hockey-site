---
name: Expression index introspection
description: Why long PostgreSQL index expressions can produce truncated Publish migration SQL.
---

Long expression indexes can be truncated during introspection when a query uses `coalesce(a.attname, pg_get_indexdef(...))`: PostgreSQL infers the identifier type `name`, limiting the result to 63 bytes. The database's original expression remains valid; the generated migration can be invalid.

**Why:** Read-only reproduction returned an expression cut off mid-cast while `pg_get_indexdef` alone returned the complete expression. The installed Drizzle introspection query uses this COALESCE.

**How to apply:** Compare the complete catalog definition with the actual introspection result before attributing a failure to data or regex syntax. For normalization uniqueness, a stored generated column plus a plain-column unique index avoids the coercion without weakening database enforcement. Verify introspection round-trips into executable SQL. Apply changes only to development; production schema changes remain owned by Publish. Do not patch installed dependencies as a durable fix.
