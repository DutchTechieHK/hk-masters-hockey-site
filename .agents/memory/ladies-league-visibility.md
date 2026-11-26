---
name: Ladies league visibility
description: Confirmed Ladies team divisions and scope for public team coverage.
---

Show team and player names publicly for Ladies Masters A, Masters B and Masters C. Ladies Masters A plays in the Premier League, Masters B in Division 2, and Masters C in Division 3. Men's Masters A plays in Division 1, not the Premier League.

The fees are the same for the Ladies Masters.

**Why:** The user explicitly confirmed the same fees apply.

**How to apply:** Present shared fees for Men's and Ladies Masters rather than labelling the fees as men-only. Do not infer new division-based fee rules from the Ladies teams' league divisions.

**Why:** The user confirmed these distinctions; older website copy has different Ladies divisions.

**How to apply:** Use these divisions when updating public team coverage. Include fixtures, but do not add RSVP or related team-management features for the Ladies teams yet: they manage those themselves. The user will supply player lists later, probably in a spreadsheet; the initial version should use the known team names without inventing players. Move the Ladies Masters block above the fees.

The user supplied https://www.hockey.org.hk/WomenFixture.asp as the Ladies fixture source; the spreadsheet is still needed for player lists, not fixtures.

**Why:** Fixtures should follow the official league schedule rather than a separately maintained spreadsheet.

**How to apply:** Match Masters A/B/C only in the Home and Away columns. Their names also occur in umpiring columns, which must not create fixtures. Preserve season context and check source changes rather than promising an unimplemented automatic feed.

Keep Ladies fixtures as an independent read-only official-source feed rather than importing them into managed match records.

**Why:** The Ladies teams manage attendance themselves; merely making fixtures public must not introduce RSVP, lineup, change-notice or notification workflows. The official fixture page also does not supply scores, so past fixtures are not verified results.

**How to apply:** Preserve this separation unless the user explicitly opts into match management. Surface source flags and failures; do not invent scores or silently show an empty schedule on source failure.
