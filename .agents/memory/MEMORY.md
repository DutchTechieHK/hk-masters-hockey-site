# Memory Index

- [PWA install prompt race](pwa-install-prompt.md) — capture beforeinstallprompt pre-React in index.html; iOS has no programmatic install; SW off in dev.
- [LEGO Jar amounts & prod writes](lego-jar-amounts.md) — store full bet amount on one row (never split); prod data is read-only via executeSql, write via deployed admin API + x-admin-key; paid-only public counts + Website designation round.
- [DB migration convention](db-migration-convention.md) — edit schema + push = dev only; prod schema is applied automatically by the Publish diff (re-publish). Do NOT write ad-hoc migrations/*.sql or startup DDL.
- [api-server dev needs restart](api-server-dev-restart.md) — api-server dev runs tsx (no watch); restart the workflow after API edits or it serves stale code.
- [Video artifact unregistered port fix](video-artifact-port-fix.md) — createArtifact may not add port to .replit [[ports]]; use configureWorkflow without waitForPort with PORT/BASE_PATH inline in command.
