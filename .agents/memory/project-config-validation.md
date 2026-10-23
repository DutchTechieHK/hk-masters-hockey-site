---
name: Project config validation
description: Required validation path for targeted edits to the protected .replit configuration.
---

To change `.replit`, preserve the complete current TOML in a temporary workspace file, make only the intended configuration change, and call `verifyAndReplaceDotReplit({ tempFilePath: absoluteWorkspacePath })`.

**Why:** Direct patching of `.replit` is rejected by the workspace tooling. The replacement callback validates the full configuration before applying it.

**How to apply:** Use this flow for deployment settings not owned by another dedicated configuration tool. Do not edit artifact manifests this way, and do not change unrelated environment values, ports, workflows, or services when copying the configuration.
