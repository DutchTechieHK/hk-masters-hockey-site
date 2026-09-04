---
name: GitHub push authentication
description: Safe deployment flow when the GitHub connector is attached but shell Git remains unauthenticated.
---

**Rule:** For this repository, use Replit's repository Sync action or ask the user to push the prepared local commit when `git push origin main` reports missing or invalid authentication. Do not emulate a local Git push by synthesizing commits through GitHub's Git Data API.

**Why:** The connected GitHub OAuth is available to connector API calls but does not populate the shell Git credential helper. API-created commits can normalize metadata differently from local Git, creating divergent hashes or malformed history and potentially requiring a guarded history rewrite.

**How to apply:** Commit the exact scoped files locally, run `git pull -X ours origin main`, attempt the normal push once, and if authentication fails leave the clean commit ready for repository Sync/manual push.