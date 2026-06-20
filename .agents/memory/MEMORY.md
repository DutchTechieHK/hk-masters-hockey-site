# Memory Index

- [PWA install prompt race](pwa-install-prompt.md) — capture beforeinstallprompt pre-React in index.html; iOS has no programmatic install; SW off in dev.
- [LEGO Jar amounts & prod writes](lego-jar-amounts.md) — store full bet amount on one row (never split); prod data is read-only via executeSql, write via deployed admin API + x-admin-key; paid-only public counts + Website designation round.
- [DB migration convention](db-migration-convention.md) — edit schema + push = dev only; prod schema is applied automatically by the Publish diff (re-publish). Do NOT write ad-hoc migrations/*.sql or startup DDL.
- [api-server dev needs restart](api-server-dev-restart.md) — api-server dev runs tsx (no watch); restart the workflow after API edits or it serves stale code.
- [feePaid semantics](fee-paid-semantics.md) — feePaid is ledger-derived; PUT recomputes it. Manual "fully paid" checkbox only wins for zero-fee staff (no due, no payments).
- [Admin tutorial video controls & sound](admin-video-controls.md) — clips open in a new tab; controls/unmute only show with `?view=1` (or iframed); export URLs stay flag-free; unmuted autoplay is browser-blocked.
- [Video artifact unregistered port fix](video-artifact-port-fix.md) — unregistered artifact port → dev workflow shows FAILED (health check) yet prod is unaffected; artifact workflows can't be overridden (configureWorkflow = PROHIBITED). Fix = remove a redundant artifact or port-swap.
- [SW navigation denylist](sw-navigation-denylist.md) — public-site SW hijacks cross-artifact navigations not in its denylist → public 404 in prod only (hard-refresh works, click fails); add every sibling base path.
