# Memory Index

- [PWA install prompt race](pwa-install-prompt.md) — capture beforeinstallprompt pre-React in index.html; iOS has no programmatic install; SW off in dev.
- [LEGO Jar amounts & prod writes](lego-jar-amounts.md) — store full bet amount on one row (never split); prod data is read-only via executeSql, write via deployed admin API + x-admin-key; paid-only public counts + Website designation round.
- [DB migration convention](db-migration-convention.md) — edit schema + push = dev only; prod schema is applied automatically by the Publish diff (re-publish). Do NOT write ad-hoc migrations/*.sql or startup DDL.
