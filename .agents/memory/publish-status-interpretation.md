---
name: Publish status interpretation
description: Avoid confusing the healthy serving deployment with a newer stalled or failed publishing attempt.
---

When investigating a publish, compare build timestamps with the user's current attempt before reporting success. A healthy serving deployment may coexist with a newer failed or still-running publish.

**Why:** The deployment-info response continued to report success for the live release while a newer publish was stalled. The newer failed attempt only became visible in the build history after it ended, so reporting the last listed successful build as the current attempt gave the user an incorrect answer.

**How to apply:** Distinguish the serving release, last completed publish, and current attempt. If the current attempt is not exposed by available callbacks, state that limitation and inspect the user's current Publishing logs rather than concluding it succeeded or that its progress display is stale.
