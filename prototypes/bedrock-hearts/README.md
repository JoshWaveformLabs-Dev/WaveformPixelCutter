# Hearts & Lives development add-on

Hearts & Lives **0.4.2** integrates native maximum health into the complete 0.4.1 add-on for retail Bedrock **26.60** and stable `@minecraft/server` **2.11.0**. Both packs keep their existing UUIDs so an import can upgrade a 0.4.1 installation and use its saved progression. [Download Hearts & Lives 0.4.2](dist/hearts-and-lives-dev.mcaddon) · [Standalone Hearts Probe 0.1.0](dist/hearts-probe.mcaddon)

Players begin with **10 lives and 10 native maximum hearts**. Each death costs one life and one maximum heart. At a Reanimation Table, a full Artificial Heart restores one of each and a half restores half of each. A successful recovery consumes one item from the selected stack. A player keeps the item if the grant would exceed 10 or if they are eliminated. Zero lives puts that player in Spectator on respawn, including after a rejoin.

The pack defines health groups for every living maximum from **1 through 20 HP**. On spawn, reconnect, world load, recovery and host test reset, the script reads the player's native maximum and reconciles it with the saved heart balance. The host Content Log records the player ID, reason, initial reading, saved target and measured `effectiveMax`. A failed readback produces `native_health_unverified`. The grant and inventory debit are already saved when a recovery needs a native retry. Rejoining retries synchronization.

## Progressive hunger

**Off by default.** The host can save this preference independently of Easy, Normal, Hard and Extreme. With it on, player feedback shows the intended capacity from that player's existing hunger balance. Death reduces the target by one icon. Full and half table recoveries restore one or half an icon. The native hunger bar, eating, sprinting and hunger-driven regeneration use vanilla rules in both modes. Retail validation of native hunger capacity is pending.

## Difficulty presets

New worlds and worlds upgrading with no saved settings start on **Normal**, with no recovery cooldown. The four presets use these provisional defaults.

| Preset | Recovery cooldown in gameplay ticks |
| --- | ---: |
| Easy | 0 |
| Normal | 0 |
| Hard | 200 |
| Extreme | 400 |

Run these commands in chat as the world host. They are registered with stable Host permission and can run with cheats off.

| Command | Effect |
| --- | --- |
| `/waveform:difficulty_view` | Show the active preset, all four cooldowns and the world's progressive hunger preference. |
| `/waveform:difficulty_select hard` | Select `easy`, `normal`, `hard`, or `extreme`. |
| `/waveform:difficulty_cooldown hard 100` | Set one preset to a whole number from 0 to 1,200 ticks. |
| `/waveform:difficulty_hunger on` or `off` | Save the progressive hunger preference for the world. |

Each edit changes the named preset. Easy must stay at or below Normal. Raise Normal before a higher Easy edit, or lower Easy before lowering Normal past it. Selecting a preset or editing its value saves it for this world.

A successful table recovery starts the configured cooldown for that player across both heart types. An existing cooldown keeps its issued deadline through edits, preset switches, and a graceful save and reopen. Denied attempts keep the item and leave the deadline unchanged. A cooldown uses gameplay ticks while the world runs. The existing host test reset clears the target player's cooldown along with resetting their balances.

## Reanimation Table

Players start without a Reanimation Table. To make one in ordinary Survival, pick up a diamond to unlock the recipe and arrange these ingredients in a crafting table.

```text
O R O
G C G
O D O
```

- **O** is obsidian (4).
- **R** is redstone dust (1).
- **G** is a gold ingot (2).
- **C** is a crafting table (1).
- **D** is a diamond (1).

The recipe yields one placeable Reanimation Table. Any eligible player can use the same placed table with their own Artificial Hearts. To relocate it, mine it in Survival with block drops enabled, pick up the dropped table, and place it at the new location.

For development testing in a disposable world with cheats enabled, the host can still obtain a table and hearts with these commands.

```text
/give @s waveform:reanimation_table 1
/give @s waveform:artificial_heart 3
/give @s waveform:half_artificial_heart 3
/give @s waveform:hearts_probe 1
```

Place the table. Select a full or half heart in the hotbar, aim at the placed table, and press **Use/Interact** once. The default is right-click on Windows and L2 on PS5. Release the button before the next interaction. Recovery applies to the player using the table. The host can hand a test kit to a normal guest.

## Artificial Heart recipes

Use a crafting table. **D** is a diamond, **N** is a netherite ingot, **H** is a Heart of the Sea, and **·** is empty. A diamond unlocks each recipe.

| Item | Rows, top to bottom | Cost |
| --- | --- | --- |
| Artificial Heart | `DND` / `DHD` / `DND` | 6 diamonds, 2 netherite ingots, 1 Heart of the Sea |
| Half Artificial Heart | `DN` / `DH` / `D·` | 3 diamonds, 1 netherite ingot, 1 Heart of the Sea |

Each recipe yields one item. Use the crafted heart at the Reanimation Table.

## Crafting and relocation test

In a fresh Survival world with cheats and experiments off, confirm that players spawn without a table. Pick up a diamond, check recipe-book discovery, and craft the exact pattern above. Check that one table is produced and that the correct materials are consumed. Place it and have two eligible players recover at the same table. Mine it with an ordinary pickaxe and block drops enabled, collect the single drop, place it elsewhere, and repeat recovery. Run this check on retail Windows and repeat as a normal PS5 guest in the Windows-hosted world.

## Windows test

For a quick acceptance run, enable the two **Hearts & Lives 0.4.2** packs alone in a disposable Survival world. Other packs that replace `minecraft:player`, including the standalone Native Health and Native Hunger probes, can take precedence. The **Hearts Probe item included here** reads the integrated player's actual attributes. Use it in air after each step and capture the HUD after natural healing. Allow up to 60 gameplay ticks for reconciliation. Keep player B alive at the starting maximum for comparison.

| Action by player A | Lives | Expected HP maximum without Health Boost |
| --- | ---: | ---: |
| First spawn | 10 | 20 |
| Die and respawn twice | 8 | 16 |
| Use a full heart at the table | 9 | 18 |
| Use a half heart at the table | 9½ | 19 |
| Leave, rejoin, save and reopen | 9½ | 19 |
| Use a second half heart at the table | 10 | 20 |

Damage A nonlethally before recovery and check current HP immediately afterward. Let food or a healing potion restore HP to the new ceiling. At 19 HP, capture the final half-heart appearance when fully healed. At every step, B should still have 20 maximum HP and both hunger maxima should read 20. Repeat a reduced-cap join with an active Health Boost in a cheats-enabled copy and check the measured maximum both during the effect and after it expires.

1. In retail Minecraft for Windows, enable **Content Log File** under **Settings → Creator** and use **Info** or **Verbose** logging. Import the development `.mcaddon` and activate both Hearts & Lives packs in a disposable Survival world. Keep all experiments off. Record the exact game build, pack versions and cheats setting. Use a cheats-enabled test copy for `/give`, `reset_lives`, and `set_current`. Use default Normal for the recovery checks below.
2. Confirm the Reanimation Table name, inventory icon, placed appearance and normal placement in Survival. Check both heart recipes for unlock, exact costs, output names and icons, and the absence of a full-to-half conversion. With two players online, bring player A to 8 lives by dying twice, while B remains at 10. On respawn, use a heart in empty air, on another block, and then at the table. Each of the first two attempts should leave the balance at 8 and the stack intact. At the table, one full heart should take A to 9. A half heart should take A to 9½. At 9½, verify the full heart is retained, then use a half heart to reach 10. Verify both hearts are retained at 10 and B remains at 10 throughout.
3. With enough deficit and at least two hearts in the selected stack, hold Use/Interact on the table. Expect one debit and one grant. Release and press again to test a second grant and consumption of the last item. Try an empty hand, a different item, quick slot changes, dropping the item, and breaking the table during an interaction. Match each successful recovery log to its player, debit and grant. Upgrade a disposable v0.4.1 world copy with a known reduced balance and any active cooldown. Verify the expected native maximum, inventory and remaining cooldown after a graceful save and reopen.
4. Repeat a death followed by a rejoin, a disconnect on the death screen, and a non-player death. Check the `[Hearts & Lives]` log for player IDs, one deduction per player death and correct spawn balances. At zero, verify Spectator immediately on respawn and after rejoin and world reopen. Attempt table use as the eliminated player and verify the other player can still play. In a cheats-enabled copy, the host can run `/waveform:reset_lives @s` or target exactly one online player by name. Reset restores all three balances and returns a Spectator target to Survival after verifying the saved state. Check that normal members are denied this command.
5. Use **Hearts Probe** (`waveform:hearts_probe`) while aiming into empty air. Check the action bar and `[Hearts Probe]` log for native attributes. In a cheats-enabled copy the host can run `/waveform:set_current health 18` or `/waveform:set_current hunger 18` to test the current-value readback.

### Difficulty checks

1. In a cheats-off Windows world with experiments off, verify the host can view settings, select each preset, and edit each value. Try `-1`, `1201`, and a fractional value. Try raising Easy above Normal and lowering Normal below Easy. Verify that each rejection preserves every saved value. Have a normal guest attempt both write commands and confirm the host's view stays the same.
2. In the fixture world, give two players enough deficit and stacked hearts. Select Hard and set it to 100 ticks. Recover as player A and verify player B can recover during A's cooldown. At one tick remaining, verify the next attempt leaves A's heart and balance intact. At the issued deadline, the next eligible attempt should grant. For exact boundary evidence use the host log's `recoveryTick`, the successful entry's `state.recoveryReadyAt`, and the denial entry's `remainingTicks`.
3. Edit Hard and switch to Normal while an issued cooldown is active. Verify the existing deadline and the duration of the next successful recovery. For save/reopen, use a longer fixture such as 1,200 ticks, save while the wait is still active, then view the saved selection and all values after reopening. Check the player's remaining cooldown and confirm Normal starts no new wait at its default value.
4. Confirm progressive hunger starts OFF. Turn it ON, switch presets, die, recover at the table, and save and reopen. Compare the saved target with the probe's native food maximum of 20. Turn the preference OFF again. Check ordinary eating, sprinting and regeneration in both modes and guest denial of the hunger command.

## PS5 guest test

1. With separate signed-in Microsoft accounts and online play enabled, join an unmodified Windows-hosted world from PS5 via **Play → Friends** or an invite. Enable **Require players to accept resource packs to join** on the disposable pack world. Join it via the same route and accept its resource download.
2. As a normal guest in Survival, verify the Reanimation Table and all three item names and icons. Receive a kit from the host. Use a full and half heart at the placed table with **L2** by default. Repeat the Windows checks for air and other blocks, hold and release, a last item, and the half-unit restriction at 9½. Confirm the guest's balance, inventory and chat feedback against the host log. Switch which player recovers while watching the other player's balance to verify multiplayer isolation.
3. With a positive cooldown selected, check that the guest cannot select or edit presets. Recover with L2 and confirm independence of the host's and guest's waits. Rejoin while a wait is active and check the host log and the guest's next eligible use.
4. Use the included Hearts Probe with L2 while aiming into empty air. Repeat the HP sequence in the Windows table with the PS5 guest as player A. Compare the guest HUD at even and odd maxima with the host's `native_health_verified` records. Repeat damage and healing, elimination, leave/rejoin and host save/reopen. Check ordinary hunger in both preference modes. Record both retail builds, pack versions, join or resource errors, screenshots and Windows logs.

## Build and validation

Use Node.js 24 and Python 3.10 or newer (`python` on Windows, `python3` on Linux and macOS). From this directory run `npm ci`, `npm run build`, and `npm run validate`. Validation type-checks against the pinned stable API, runs logic and mocked adapter tests, and checks the 20 health groups against the pinned vanilla player, pack versions and identities, exact recipes, the table's self-drop, textures, scripts and both nested archives. The integrated build awaits Windows and PS5 gameplay testing. [Milestone handover](HANDOVER.md)
