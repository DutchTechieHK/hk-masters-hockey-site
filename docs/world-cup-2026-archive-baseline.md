# World Cup 2026 Archive Baseline

Snapshot taken from the read-only production database on 10 September 2026, before the management app switched to the Local Masters League & Socials default view.

## Reconciliation baseline

| Archived record group | Production rows |
| --- | ---: |
| Announcements | 10 |
| News posts | 2 |
| Polls | 1 |
| Poll options | 2 |
| Poll votes | 29 |
| Email sends | 122 |
| Email recipients | 318 |
| Logistics tasks | 22 |
| Kit orders | 0 |
| Kit distributions | 0 |
| Fundraising pledges | 126 |
| Documents | 16 |
| Matches | 10 |
| Events | 80 |
| Rotterdam participations | 40 |
| Rotterdam payments | 27 |

## Archive rules

- Existing announcements, news posts, polls, and email sends are classified as World Cup 2026 archive content when the operational-scope fields are introduced.
- World Cup-only modules remain archived in place. Their records, identifiers, timestamps, relationships, files, financial amounts, and audit history are not deleted or copied into replacement tables.
- Rotterdam participation and payment rows remain attached to the existing `rotterdam-2026` season.
- The production database remains authoritative. Development has different seed and test data and must not be used to overwrite production while publishing this change.
- After publishing, compare the archive totals against this baseline. Differences should be explained by intentional activity after the snapshot, not by migration or filtering.

## File preservation

The archive change does not delete document rows or uploaded objects. The 16 production document rows and their existing object references remain in place.