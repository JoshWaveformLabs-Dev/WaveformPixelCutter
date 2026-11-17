# Session 003 handover

The development package ships the life loop, Artificial Hearts, and the existing Hearts Probe. The [build and manual test instructions](README.md) supersede the historical test plan's recipe patterns and split-recipe fixture for this milestone. The half item has its own Heart of the Sea cost.

- **State.** A version 2 JSON record lives in a world dynamic property keyed by the opaque player entity ID under the retained behavior pack UUID. An absent record starts at 20 half-units for each balance. The v1 migration fixture expands a linked `units` balance into separate fields. The prior probe wrote no life records. Invalid or future records are left intact for inspection.
- **Death and recovery.** A persisted death latch remains set until a usable spawn. A per-player tick guard and a live-health check suppress additional observable duplicates. Elimination is enforced when a live player is reconciled. Recovery verifies the selected stack and the debit, then writes the new state synchronously. If a write leaves the old state readable, script compensates an exact verified debit. Uncertain outcomes are logged without replacing a changed stack.
- **Automated evidence.** Strict TypeScript compile/type-check, 30 tests including mocked Bedrock adapters and transaction faults, static pack checks, and archive validation. Stable API references and human test cases remain separate from the automated results.

## Open runtime gates

- Import/load with experiments off and verify item rendering, recipe discovery, right-click/L2 activation, and one reported grant per debit. Verify normal-member command denial and host reset behavior.
- Confirm death event order, opaque player IDs across sessions, and immediate Spectator behavior on retail respawn. The stable death event has no unique ID. A late duplicate with an unreadable handle after respawn cannot be identified independently of event ordering.
- Verify graceful save/reopen. Container changes and world dynamic properties have no shared durable transaction. A process interruption between writes can leave the inventory and life record out of sync.
- Confirm private pack delivery and controller use in a PS5 guest session. No Windows or PS5 gameplay tests were run. Native maximum changes and permanent HUD work remain outside the milestone.
