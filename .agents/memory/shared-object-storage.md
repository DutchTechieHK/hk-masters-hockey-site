---
name: Shared object storage across dev and prod
description: Dev workspace and the deployed app use the same App Storage bucket — object edits from the workspace take effect in prod instantly.
---

# Shared object storage across dev and prod

The workspace and the published deployment share the same object storage bucket (same `PRIVATE_OBJECT_DIR` / `DEFAULT_OBJECT_STORAGE_BUCKET_ID`).

**Why:** Confirmed when fixing "photos not loading" on the live site — oversized images (10–14 MB) in storage were recompressed via the workspace sidecar (127.0.0.1:1106 signed URLs) and the live site was fixed immediately, with no re-publish and no DB change (objects were rewritten in place at the same paths).

**How to apply:**
- To fix bad/oversized objects in prod, run maintenance scripts from the workspace directly — no need to go through the deployed admin API (that's only for prod *database* writes).
- Conversely, be careful: deleting or overwriting objects in dev also affects prod.
- Re-publish is still required for *code* changes (e.g. upload-time compression) to run in prod.
