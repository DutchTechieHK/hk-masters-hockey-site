# Memory Index

- [PWA install prompt race](pwa-install-prompt.md) — capture beforeinstallprompt pre-React in index.html; iOS has no programmatic install; SW off in dev.
- [LEGO Jar amounts & prod writes](lego-jar-amounts.md) — store full bet amount on one row (never split); prod data is read-only via executeSql, write via deployed admin API + x-admin-key; paid-only public counts + Website designation round.
- [DB migration convention](db-migration-convention.md) — edit schema + push = dev only; prod schema is applied automatically by the Publish diff (re-publish). Do NOT write ad-hoc migrations/*.sql or startup DDL.
- [api-server dev needs restart](api-server-dev-restart.md) — api-server dev runs tsx (no watch); restart the workflow after API edits or it serves stale code.
- [feePaid semantics](fee-paid-semantics.md) — feePaid is ledger-derived; PUT recomputes it. Manual "fully paid" checkbox only wins for zero-fee staff (no due, no payments).
- [Admin tutorial video controls & sound](admin-video-controls.md) — clips open in a new tab; controls/unmute only show with `?view=1` (or iframed); export URLs stay flag-free; unmuted autoplay is browser-blocked.
- [Video artifact unregistered port fix](video-artifact-port-fix.md) — unregistered artifact port → dev workflow shows FAILED (health check) yet prod is unaffected; artifact workflows can't be overridden (configureWorkflow = PROHIBITED). Fix = remove a redundant artifact or port-swap.
- [SW navigation denylist](sw-navigation-denylist.md) — public-site SW hijacks cross-artifact navigations not in its denylist → public 404 in prod only (hard-refresh works, click fails); add every sibling base path.
- [Composite TS project references stale types](composite-project-references-stale-types.md) — after schema edits in lib/db, run `tsc -b --force` there or consumer typecheck shows false missing-property errors.
- [openapi.yaml schema drift](openapi-schema-drift.md) — missing schema crashes boot; missing *field* on existing schema silently strips it from validation on codegen rerun (data loss). Diff generated output before trusting a regen.
- [hk-masters admin auth testing](hk-masters-admin-auth-testing.md) — no dev bypass for the team-password gate; insert an admin_sessions row + temp-patch AdminAuthGate to e2e-test admin pages, then fully revert.
- [Email send throttle & failure visibility](email-send-throttle.md) — bulk email loops must pace ~500ms (Resend ~2/sec) and report a `failed` count; unthrottled loops 429 silently and drop sends.
- [Admin app URL & custom domain](admin-app-url.md) — admin portal is at app.hkmastershockey.com/admin/ in prod; ADMIN_APP_URL must be split dev/prod env vars, never shared.
- [Shared object storage dev/prod](shared-object-storage.md) — one bucket for both; workspace scripts can fix prod objects in place instantly, but dev deletions also hit prod.
- [Prod contribution writes send emails](prod-contribution-writes.md) — contributions PUT always re-emails authors on approved/declined; no email-free prod bulk-rewrite path exists.
