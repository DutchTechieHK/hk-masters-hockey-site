# Historical source

This read-only showcase is based on the HK Masters Hockey repository snapshot
from 31 July 2026:

- Git commit: `6f9b59db23ae02b62e8cb590f8ff9b4750a2774f`
- Local preservation branch: `archive/world-cup-2026-2026-07-31`

The showcase is a separate artifact. It does not import or run the historical
mutation routes. Its only API dependency is a GET-only aggregate endpoint that
reads the immutable World Cup snapshot tables and records explicitly scoped to
`world_cup_2026`. The page and endpoint both require a current HK Masters admin
session; the user enters the existing club admin password only to obtain that
session and the password is never stored.

The archive response excludes names, contact details, document URLs, access
tokens, travel notes, and other player-level personal information.