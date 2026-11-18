# Hearts & Lives development add-on

Hearts & Lives **0.5.0** upgrades the retail-tested Windows 0.4.2 packs in place. Import the add-on and enable its behavior and resource packs together. It targets Bedrock **26.60**, stable `@minecraft/server` **2.11.0** and `@minecraft/server-ui` **2.3.0**. The pack UUIDs and saved player records carry forward. [Download Hearts & Lives](dist/hearts-and-lives-dev.mcaddon) · [Standalone Hearts Probe](dist/hearts-probe.mcaddon)

Players start with **10 lives and 10 native maximum hearts**. Each death removes one of each. At zero lives the player enters Spectator on respawn. To recover before elimination, select an empty hotbar slot and use a placed Reanimation Table. Each Restore button spends materials from your own inventory and raises both your remaining lives and your native maximum health.

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

A successful table recovery starts the configured cooldown for that player across both recovery sizes. An existing cooldown keeps its issued deadline through edits, preset switches, and a graceful save and reopen. Denied attempts keep the materials and leave the deadline unchanged. A cooldown uses gameplay ticks while the world runs. The existing host test reset clears the target player's cooldown along with resetting their balances.

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

The recipe makes one table. Mine it with block drops enabled to relocate it. Players can share a table. Each player sees their own inventory and cooldown.

### Using the station

Select an empty hotbar slot and right-click the table on Windows or use **L2** with the default PS5 controls. The screen shows remaining lives, measured native maximum hearts, the recoverable base limit, the active difficulty and the cooldown. Each ingredient shows your total across hotbar and backpack slots, the quantity each option needs and how many are missing. The counts and cooldown refresh once per second of gameplay while the screen is open.

| Restore | Diamonds | Netherite Ingots | Heart of the Sea | Gain |
| --- | ---: | ---: | ---: | --- |
| 1 heart | 6 | 2 | 1 | 1 life and 1 maximum heart |
| ½ heart | 3 | 1 | 1 | ½ life and ½ maximum heart |

**Normal costs are approved. Easy, Hard and Extreme provisionally use the same costs** until their own recipes are approved. The four entries are configurable in the [recovery price table](src/recovery-materials.ts). Each preset retains its own cooldown.

Select the enabled recovery size to pay immediately. At 9½ lives, only a half recovery fits. At full capacity, both buttons are disabled. Close the screen to gather missing materials. Existing Artificial Hearts from earlier worlds can still be redeemed by holding one and using the table. The two legacy heart recipes have been removed from the pack.

## Crafting and relocation test

In a fresh Survival world with cheats and experiments off, confirm that players spawn without a table. Pick up a diamond, check recipe-book discovery, and craft the exact pattern above. Check that one table is produced and that the correct materials are consumed. Place it and have two eligible players recover at the same table. Mine it with an ordinary pickaxe and block drops enabled, collect the single drop, place it elsewhere, and repeat recovery. Run this check on retail Windows and repeat as a normal PS5 guest in the Windows-hosted world.

## Windows test

The user physically confirmed the 0.4.2 Windows baseline through all ten deaths, the shrinking vanilla HUD, zero-life Spectator and a save/quit/reopen. The following checks cover the new 0.5.0 form.

1. Import 0.5.0 into a disposable world or a copy of a 0.4.2 world. Enable both Hearts & Lives packs, with experiments off. Use a separate world for the standalone probes. Enable the Creator Content Log and record the game build and pack versions.
2. On Normal, have A die twice while B stays alive. Place a table. Give A four diamonds, two netherite ingots and one Heart of the Sea. With an empty hand, open the station. Expect 8 lives, 8 current maximum hearts and a limit of 10. The full option should show two diamonds missing, and the half option should be affordable. Close the form without paying.
3. Add two diamonds to a different inventory slot. Open and choose **Restore 1 Heart**. Expect exactly six diamonds, two ingots and one Heart of the Sea consumed, 9 lives and a native maximum of 18 HP. Supply the half recipe and select **Restore ½ Heart**. Expect 9½ lives and 19 HP. Leave, rejoin, save and reopen. The half-heart maximum should persist. At 9½, supply enough for either option and verify that only half can be selected. At 10, verify that both are disabled. Compare A and B at each step.
4. Damage A before restoring. Use the included Hearts Probe in air to compare current HP and maximum HP, then heal naturally to see the HUD ceiling. Compare the HUD against the host's `native_health_verified` readback. Reconciliation can take up to 60 ticks. Repeat a reduced-cap join with Health Boost in a cheats-enabled test copy.
5. Hold Use, dismiss the form, reopen it and try consecutive presses. Each deliberate selection should spend one recipe. With A's form open, have B remove the table. In a separate attempt, have the host change the preset. Verify the stale choice spends nothing. Repeat with a disconnection. Check a previously crafted 0.4.2 heart in an upgraded copy and verify that the ordinary crafting book offers only the table recipe from this recovery system.
6. Die through elimination. Check Spectator on respawn, reconnect and world reopen. Confirm the guest keeps their own progression. In a cheats-enabled fixture the host can reset one online target with `/waveform:reset_lives @s`. For fast setup, use `/give @s waveform:reanimation_table`, vanilla material IDs and `/give @s waveform:hearts_probe`.

### Difficulty checks

1. In a cheats-off Windows world with experiments off, verify the host can view settings, select each preset, and edit each value. Try `-1`, `1201`, and a fractional value. Try raising Easy above Normal and lowering Normal below Easy. Verify that each rejection preserves every saved value. Have a normal guest attempt both write commands and confirm the host's view stays the same.
2. In the fixture world, give two players enough deficit and materials for multiple recoveries. Select Hard and set it to 100 ticks. Recover as player A and verify player B can recover during A's cooldown. Keep A's form open through the countdown. Check that Restore stays disabled until the first refresh after the deadline and that waiting spends nothing. Select it when it enables and compare the new balance with the host log's `recoveryTick` and `state.recoveryReadyAt`.
3. Edit Hard and switch to Normal while an issued cooldown is active. Verify the existing deadline and the duration of the next successful recovery. For save/reopen, use a longer fixture such as 1,200 ticks, save while the wait is still active, then view the saved selection and all values after reopening. Check the player's remaining cooldown and confirm Normal starts no new wait at its default value.
4. Confirm progressive hunger starts OFF. Turn it ON, switch presets, die, recover at the table, and save and reopen. Compare the saved target with the probe's native food maximum of 20. Turn the preference OFF again. Check ordinary eating, sprinting and regeneration in both modes and guest denial of the hunger command.

## PS5 guest test

1. With separate signed-in Microsoft accounts and online play enabled, join an unmodified Windows-hosted world from PS5 via **Play → Friends** or an invite. Enable **Require players to accept resource packs to join** on the disposable pack world. Join it via the same route and accept its resource download.
2. As a normal member with an empty hotbar slot selected, open the placed table with **L2**. Check all three ingredient icons, text readability, scrolling, focus, disabled buttons and dismiss without payment. Run the full and half recovery sequence above using the controller. Compare the guest's inventory, HUD and measured HP with the host's. Test simultaneous use at one table.
3. As host, select Hard. Verify that the guest can use the station during the host's cooldown and cannot change difficulty. Check the guest's countdown, rejoin, elimination and host save/reopen. Record both game builds, any resource or form errors, HUD screenshots and the Windows Content Log.

## Build and validation

Use Node.js 24 and Python 3.10 or newer (`python` on Windows, `python3` on Linux and macOS). From this directory run `npm ci`, `npm run build`, and `npm run validate`. Validation type-checks against the pinned stable API, runs logic and mocked adapter tests, and checks the 20 health groups against the pinned vanilla player, pack versions and identities, exact recipes, the table's self-drop, textures, scripts and both nested archives. The V2 table awaits retail Windows and PS5 gameplay checks. [Milestone handover](HANDOVER.md)
