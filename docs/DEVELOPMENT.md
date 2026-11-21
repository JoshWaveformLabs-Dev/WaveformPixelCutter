# Development

This document covers building, testing, packaging and releasing Hearts & Lives. Player documentation is in the [README](../README.md) and the [Player Guide](PLAYER_GUIDE.md). Detailed engineering decisions for the current release are in the [v0.5.3 handover](../prototypes/bedrock-hearts/HANDOVER.md).

## Repository layout

```text
README.md                         Player-facing overview
docs/
  PLAYER_GUIDE.md                 Install, update, multiplayer, troubleshooting
  KNOWN_LIMITATIONS.md            Unverified, provisional and unsupported behaviour
  DEVELOPMENT.md                  This file
  SCREENSHOT_CHECKLIST.md         Screenshots still to capture
  hearts-feasibility.md           Original API feasibility study
  hearts-prototype-test-plan.md   Original prototype test plan
  features/falling-trees.md       Proposed feature for a future survival overhaul (not Hearts & Lives)
prototypes/
  bedrock-hearts/                 The Hearts & Lives add-on
    behavior_pack/                Manifest, block, items, recipe, loot table
    resource_pack/                Manifest, textures, atlases
    src/                          TypeScript sources (compiled to scripts/)
    test/                         node:test suites with Bedrock and UI mocks
    tools/package.mjs             Build entry point (calls package_addon.py)
    tools/package_addon.py        Assembles and validates the .mcaddon
    dist/                         Release archives (committed)
    HANDOVER.md                   Release engineering notes
    README.md                     Retail Windows and PS5 acceptance procedures
  bedrock-native-caps/            Native Health/Hunger Probe diagnostic packs
    vendor/player.json            Pinned vanilla player definition (Mojang, EULA)
```

### Source modules

| File | Responsibility |
| --- | --- |
| `lives-state.ts` | Pure state model: half-heart units (max 20), death deduction, recovery planning, save format v1/v2 decoding |
| `lives-store.ts` | Verified reads and writes of per-player dynamic properties |
| `lives-bedrock.ts` | Bedrock events: death, spawn, world load, table interaction, `reset_lives` command |
| `native-health.ts` | Selects the native health component group (1 to 20 HP) and verifies `effectiveMax` |
| `recovery.ts` | Material debit, grant and compensating refund transaction |
| `recovery-materials.ts` | Restore prices per difficulty preset and inventory counting |
| `recovery-form.ts` | The `CustomForm` table screen |
| `recovery-clock.ts` | World-persistent gameplay tick clock for cooldowns |
| `difficulty-settings.ts` / `difficulty-bedrock.ts` | Preset model and host commands |
| `diagnostics.ts` / `main.ts` | Hearts Probe item and `waveform:set_current` probe command |

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 24 |
| Python | 3.10 or newer (`python` on Windows, `python3` elsewhere) |
| npm dev dependencies | `@minecraft/server` 2.11.0, `@minecraft/server-ui` 2.3.0, `typescript` 5.9.3 (pinned in `package.json`) |
| Target game | Retail Bedrock 26.60 or newer (`min_engine_version` `[1, 26, 60]`), experiments off |

`node_modules/` and the `.build/` compile output are git-ignored.

## Build, test and validate

From `prototypes/bedrock-hearts`:

```sh
npm ci              # install pinned dev dependencies
npm run check       # type-check against the pinned stable API
npm test            # compile and run all test/*.test.js suites
npm run build       # compile and write dist/hearts-and-lives-v<version>.mcaddon
npm run validate    # check + test + validate the committed archive (no rebuild)
```

`npm run validate` is the release gate. It type-checks, runs the tests and validates the following:

- All 20 native health groups against the pinned vanilla player
- Manifest versions, UUIDs and display names
- The stable script dependencies
- The exact table recipe and its diamond unlock
- The table's self-drop loot table
- 16×16 textures and atlases
- Both nested `.mcpack` archives inside the versioned `.mcaddon`

The build is deterministic. Rebuilding v0.5.3 from a clean clone produces a byte-identical archive (SHA-256 `4ccd46c123905056be2642669fa4ba8beadc01206c31ddeea5a8a56f635d53f8`).

The packager reads `../bedrock-native-caps/vendor/player.json` and `vendor/LICENSE.md`, so keep both prototypes in the same checkout.

The diagnostic probe packs have their own checks. From `prototypes/bedrock-native-caps`, run `npx tsc`, then `node --test test/*.test.js`, then `python tools/package_addons.py --check`.

### Automated tests compared with retail tests

The automated suites (100 tests for v0.5.3) run against **mocks** of `@minecraft/server` and `@minecraft/server-ui` (`test/support/`). They prove the logic, transaction safety and form wiring. They **cannot** prove the following, which need a real game client:

- Native heart HUD changes and `effectiveMax` readback timing
- Form layout, font fit and scrolling at real GUI scales
- Controller focus order and PS5 input
- Resource pack delivery to cross-platform guests
- Behaviour across process crashes

These are covered by the manual procedures in [`prototypes/bedrock-hearts/README.md`](../prototypes/bedrock-hearts/README.md#windows-test) and the [PS5 guest test](../prototypes/bedrock-hearts/README.md#ps5-guest-test). Record results and builds in the handover. The current status is in [Known Limitations](KNOWN_LIMITATIONS.md#platform-testing).

### Test-world helpers

These are for disposable test worlds only.

| Command | Requires | Effect |
| --- | --- | --- |
| `/waveform:reset_lives <player>` | Host, cheats on | Reset one online player to 10 lives and hearts, clear their cooldown and leave Spectator |
| `/waveform:set_current <health\|hunger> <points>` | Host, cheats on | Probe-write a current value and log before and after |
| `/give @s waveform:reanimation_table` | Cheats on | Get a table |
| `/give @s waveform:hearts_probe` | Cheats on | Get the probe item (shows HP and max HP in the action bar) |

Enable **Settings → Creator → Content Log File** to capture `[Hearts & Lives]` JSON records, including `native_health_verified` and `native_health_unverified` and the recovery events.

## Versioning

`package.json` `version` is the single source of truth. For release `X.Y.Z`, all of the following must agree, or validation fails:

- `package.json` `version` and both `version` fields in `package-lock.json`
- Behaviour pack header `version`, both module versions and its resource-pack dependency version: `[X, Y, Z]`
- Resource pack header `version` and module version: `[X, Y, Z]`
- Pack display names `Hearts & Lives vX.Y.Z (Behaviour)` and `Hearts & Lives vX.Y.Z (Resources)`. The build sets these in the archive, and the source manifests should match.

The archive is written to `dist/hearts-and-lives-vX.Y.Z.mcaddon`.

### Pack UUIDs: never change these

Changing a UUID makes Minecraft treat the pack as a different add-on. Existing worlds would lose their link to it, and the saved-data upgrade path would break.

| Section | UUID |
| --- | --- |
| Behaviour pack header | `b585ec4d-eb4a-4de8-b685-09912fd68045` |
| Behaviour data module | `39148b19-9a6f-41b1-819c-1f508afe0836` |
| Behaviour script module | `b1b0a19b-4df2-4ede-9348-6636d2981392` |
| Resource pack header | `d28930da-140d-495b-9244-7774e677434c` |
| Resource module | `7fe46a4c-b216-4960-9c17-f6412735a217` |

The resource pack UUID is also hard-coded in `src/recovery-form.ts` (`RESOURCE_PACK`) for the ingredient icons. The validator enforces both header UUIDs.

### Saved data

Player records are stored in world dynamic properties `waveform:hearts_lives.<playerId>` as JSON `{ version: 2, lives, hearts, hunger, awaitingRespawn, recoveryReadyAt? }` in half-heart units. Version 1 records are migrated on read. World settings use `waveform:hearts_lives_difficulty`, `waveform:hearts_lives_progressive_hunger` and `waveform:hearts_lives_recovery_clock`. Don't change these keys or formats without a migration and tests.

## Release procedure

1. Branch from `feature/hearts-native-health`, or work on it directly.
2. Bump the version everywhere listed in [Versioning](#versioning). Keep the UUIDs.
3. `npm ci && npm run build && npm run validate`. All tests must pass.
4. Run the Windows retail procedure on a **copy** of an upgraded world. Run the PS5 guest procedure if the change touches UI or networking.
5. Update `prototypes/bedrock-hearts/HANDOVER.md`, the root `README.md` (version badge, download link and feature list) and these docs.
6. Commit the source and the new `dist/hearts-and-lives-vX.Y.Z.mcaddon` together. Keep older archives.
7. Push with a normal push. Never force-push shared branches.
8. Optionally create a GitHub Release `vX.Y.Z` with the `.mcaddon` attached.

## Branches

| Branch | Purpose |
| --- | --- |
| `feature/hearts-native-health` | **Active development.** Contains v0.5.3. |
| `minecraft-survival-development` | Earlier survival line. Already merged into the feature branch. |
| `main` | Default branch. Behind the feature branch until it's merged. |
| `archive/pixel-cutter-before-minecraft` | Archive of the retired Pixel Cutter app |

## Compatibility considerations

- **Player entity override.** The behaviour pack ships `entities/player.json`. This is the pinned vanilla player plus 20 health component groups. It will conflict with any pack that also defines `minecraft:player`, and it must be re-pinned when Mojang changes the vanilla player.
- **Stable APIs only.** The project uses no beta APIs and no experiments. Upgrading `@minecraft/server` or `-ui` means updating the manifest dependencies, `package.json`, the validator constants (`SERVER`, `UI`) and `min_engine_version` together.
- **Host-authoritative.** All state lives in the host world. Clients only need the resource pack.
- **Licensing.** `vendor/player.json` and the ingredient icons in `resource_pack/textures/ui/waveform/` are Mojang assets used under the [Minecraft EULA](https://www.minecraft.net/en-us/eula). The project has no separate open-source licence file.
