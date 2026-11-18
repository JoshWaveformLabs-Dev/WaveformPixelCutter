# Session 006 difficulty handover

Hearts & Lives **0.4.0** adds host-controlled difficulty presets. The provisional defaults are Easy **0**, Normal **0**, Hard **200**, and Extreme **400** gameplay ticks. Normal is the initial preset. The host can change one preset at a time from 0 to 1,200 ticks, with Easy kept at or below Normal. Use `/waveform:difficulty_view`, `/waveform:difficulty_select <preset>`, and `/waveform:difficulty_cooldown <preset> <ticks>`. [Download](dist/hearts-and-lives-dev.mcaddon) · [Commands and retail test procedures](README.md)

- **Settings.** A versioned world record stores the active preset and named per-preset settings separately from player state. An absent record uses defaults. The flat v0 migration fixture converts to v1 on a valid host write. Malformed or unsupported records are preserved and block recovery before any item debit.
- **Recovery.** The existing v2 player record accepts an optional expiry saved with the verified grant. A script-tick checkpoint advances while a reserved deadline is outstanding and resumes from saved progress after a world reload. Existing deadlines are independent of subsequent settings edits. The behavior pack identity, ten starting lives, one-life death loss, full and half grants, inventory safeguards, and elimination rules carry forward.
- **Validation.** Stable API type-checking, 55 logic and mocked integration tests, and static validation of the development archive passed. Five tests and both separate native-cap archive checks also passed. Independent review found no blocking issues.

## Retail checks pending

- On Windows, confirm host commands with cheats and experiments off, guest denial, tick boundaries, and world settings and issued cooldowns after a graceful save and reopen. Check table interaction, existing player state, and the Hearts Probe on an upgraded world copy.
- Repeat permission, recovery, and reconnect checks with a normal PS5 guest on a Windows host. Record both builds and capture the content log and controller results.
- Verify the checkpoint and inventory behavior under actual save timing. An interruption can leave inventory and world records out of sync because they do not share a durable transaction.
