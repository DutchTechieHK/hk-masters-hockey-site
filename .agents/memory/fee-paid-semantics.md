---
name: feePaid semantics (player tournament fee)
description: How a player's feePaid status is computed vs. manually overridden, esp. for zero-fee staff.
---

# Player feePaid status

`players.feePaid` is normally **derived from the payment ledger** on save: paid when ledger total ≥ amount due (or any payment exists when no due is set). The admin player-update path recomputes feePaid rather than trusting a directly-submitted value.

**Rule:** Zero-fee participants (coaches, physios, staff) have no amount due and make no payments, so the ledger can never mark them paid. For them the admin's "Tournament Fee Fully Paid" checkbox is the source of truth.

**How to apply:** The manual flag wins ONLY when there are no payments AND no positive amount due. When there is a real positive amount due, feePaid stays ledger-driven — ticking the box must not mask an outstanding balance.

**Why:** The update path used to silently drop the submitted feePaid and recompute to false, so ticking the box for a zero-fee person reverted to Unpaid on save. Reported 2026-06-20.
