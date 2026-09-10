---
name: Read-path repair concurrency
description: Architectural rule for safe initialization or repair logic that normal read requests can invoke concurrently.
---

Any initialization or repair reachable from read requests must make first-run provisioning atomic and avoid writing rows that already contain the expected values.

**Why:** Read endpoints can fan out concurrently during one page load. Non-atomic creation can duplicate shared records, while unconditional bulk updates can deadlock otherwise independent reads.

**How to apply:** Back shared creation with a database uniqueness constraint plus conflict handling. Add changed-row predicates such as `IS DISTINCT FROM` to corrective updates.