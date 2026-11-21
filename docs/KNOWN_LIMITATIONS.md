# Known limitations

Status as of **v0.5.3**. This page separates what has been verified from what is provisional or still untested. Back to the [README](../README.md).

## Platform testing

| Area | Status |
| --- | --- |
| Death deductions, shrinking native heart bar, Spectator elimination | ✅ Observed on retail Windows (0.4.2) |
| Reanimation Table restore flow | ✅ Observed on retail Windows (0.5.1) |
| Table opening while holding items | ✅ Observed on retail Windows (0.5.2) |
| v0.5.3 pack loading with experiments off | ✅ Retail Bedrock Dedicated Server 1.26.65.1 (no player joined) |
| v0.5.3 table layout, label fit and scrolling on Windows | 🔍 Not yet signed off |
| PS5 guest joining a Windows-hosted world, receiving packs | 🔍 Not yet tested |
| PS5 controller navigation of the table (**L2** to open) | 🔍 Not yet tested |
| PS5 split-screen | 🔍 Not yet tested |
| Hosting on PS5, Xbox, Switch or mobile, or on a Realm | ❓ Not tested and not part of the intended setup |

All game logic is covered by automated tests (100 passing in v0.5.3). These run against mocks, not the real game. See [Development](DEVELOPMENT.md#automated-tests-compared-with-retail-tests).

## Provisional values

- **Restore costs for Easy, Hard and Extreme** currently copy Normal: 6 Diamonds, 2 Netherite Ingots and 1 Heart of the Sea for a full heart, and 3, 1 and 1 for a half heart. Only Normal's costs are approved.
- **Cooldowns** (Easy 0, Normal 0, Hard 200, Extreme 400 ticks) are provisional test values. The host can change them.
- The presets currently change **only** the cooldown. They don't change lives, hearts or death rules.

## Progressive hunger is a preview

The `/waveform:difficulty_hunger on` setting tracks and reports a hunger *target* only. It does **not** shrink the native hunger bar. Eating, sprinting and regeneration always use vanilla rules. Native hunger caps still need retail testing.

## Compatibility with other add-ons

- Hearts & Lives replaces the player entity definition (`minecraft:player`) to control maximum health. **Any other pack that also changes the player entity will conflict.** Which pack wins depends on pack order, and heart limits or the other pack's features may stop working.
- Effects that add maximum health, such as Health Boost, are accounted for when the add-on checks your maximum, but haven't had full retail testing.
- No other add-on combinations have been tested.

## Gameplay edge cases

- **Elimination is permanent** in normal play. Only the cheats-on host test command `/waveform:reset_lives` can revive a player.
- Deaths count in **every** game mode, including Creative.
- Cooldowns count gameplay ticks only while the world runs.
- Inventory and saved hearts are written separately. If the game process is killed at exactly the wrong moment during a restore, the inventory and the heart balance could disagree. Normal saves and exits are not affected. A restore that might have half-completed reports *"Recovery error. Check the host log before retrying."*
- After a heart change, the native maximum can take up to about 3 seconds to settle. Rejoining retries the sync.
- The table counts only the hotbar and backpack. Armour, off-hand and containers aren't counted.
- Legacy **Artificial Heart** items from 0.4 worlds can be redeemed but are hidden from Creative and can't be crafted.

## Documentation gaps

- There are no in-game screenshots yet. See the [screenshot checklist](SCREENSHOT_CHECKLIST.md).
- There is no GitHub Release page yet. The download link points to the archive committed in the repository.
