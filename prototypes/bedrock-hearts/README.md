# Hearts & Lives development add-on

Hearts & Lives **v0.5.3** upgrades v0.5.1 and v0.5.2 in place. It targets retail Bedrock **26.60** or newer, stable `@minecraft/server` **2.11.0** and `@minecraft/server-ui` **2.3.0**. The pack UUIDs and saved player records carry forward. [Download Hearts & Lives v0.5.3](dist/hearts-and-lives-v0.5.3.mcaddon) · [Standalone Hearts Probe](dist/hearts-probe.mcaddon)

To import from this Windows checkout, run the following in PowerShell. In the world's settings, enable **Hearts & Lives v0.5.3 (Behaviour)** and **Hearts & Lives v0.5.3 (Resources)** together, with experiments off.

```powershell
Invoke-Item -LiteralPath 'C:\Projects\minecraft heart\prototypes\bedrock-hearts\dist\hearts-and-lives-v0.5.3.mcaddon'
```

Players start with **10 lives and 10 native maximum hearts**. Each death removes one of each. At zero lives the player enters Spectator on respawn. To recover before elimination, use a placed Reanimation Table. **RESTORE HEART** spends materials from your inventory and raises both your remaining lives and your native maximum health.

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

In Creative, open **Items** or search for **Reanimation Table**. Select the textured block, place it, then use it again while standing. You can keep the stack of tables selected. The two legacy Artificial Hearts are hidden from Creative.

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

Right-click the table on Windows or press **L2** with the default PS5 controls. Standing use opens the table with an empty hand, a building block, a material or a tool. Crouch to place another block against it. The dropdown shows your permanent hearts out of ten and lets you select **Full Heart** or **Half Heart**. Switching size previews the new recipe immediately.

Each item icon shows how much of its recipe you can supply. **Diamond 4/6 - Need 2** means you need two more diamonds. **Diamond 6/6 - Ready** means you have enough, including when you carry more than six. Green means ready and red means more are needed. The short labels **Netherite** and **Sea Heart** mean Netherite Ingot and Heart of the Sea. Counts include the hotbar and backpack and refresh once per second of gameplay.

| Restore | Diamonds | Netherite Ingots | Heart of the Sea | Gain |
| --- | ---: | ---: | ---: | --- |
| 1 heart | 6 | 2 | 1 | 1 life and 1 maximum heart |
| ½ heart | 3 | 1 | 1 | ½ life and ½ maximum heart |

**Normal costs are approved. Easy, Hard and Extreme provisionally use the same costs** until their own recipes are approved. The four entries are configurable in the [recovery price table](src/recovery-materials.ts). Each preset retains its own cooldown.

Press **RESTORE HEART** when it lights up. A brief confirmation shows your new total before the screen closes. At 9.5 hearts the table opens with Half Heart selected. At 10, it shows **ALL HEARTS RESTORED!**. If you need to wait, the table shows how many seconds are left. You can close it at any time.

To redeem an Artificial Heart saved in an older world, hold it and use the table. Both legacy hearts are hidden from Creative and have no crafting recipes.

## Crafting and relocation test

In a fresh Survival world with cheats and experiments off, confirm that players spawn without a table. Pick up a diamond, check recipe-book discovery, and craft the exact pattern above. Check that one table is produced and that the correct materials are consumed. Place it and have two eligible players recover at the same table. Mine it with an ordinary pickaxe and block drops enabled, collect the single drop, place it elsewhere, and repeat recovery. Run this check on retail Windows and repeat as a normal PS5 guest in the Windows-hosted world.

## Windows test

Use a disposable, peaceful test world or a copy for the following Windows and PS5 checks. The v0.5.1 recovery flow and the v0.5.2 form opening have been observed in retail Bedrock.

1. Import v0.5.3 and enable both packs on a copy of an earlier world with experiments off. Check both display names and a returning player's balance. In Creative, find the table under Items and via search, place it, and verify that searching for “Artificial Heart” returns neither legacy item. Record the build and enable the Creator Content Log for the test.
2. On Normal, use a fixture where A has eight permanent hearts. Give A four diamonds, two netherite ingots and one Heart of the Sea. Open the table while holding a diamond. Expect **8 / 10 Hearts**, **Diamond 4/6 - Need 2** in red and a disabled Restore button. Switch to Half Heart and check the green **Diamond 3/3 - Ready**, **Netherite 1/1 - Ready** and **Sea Heart 1/1 - Ready** rows. Check that each icon and the entire last word fit at your usual resolution and GUI scale. Close and check the inventory.
3. Add two diamonds to a different slot. Open the table on Full Heart and press **RESTORE HEART** twice quickly. Expect one debit of 6/2/1, a confirmation at **9 / 10 Hearts**, and 18 native maximum HP. Supply the half recipe, select Half Heart and confirm. Expect **9.5 / 10 Hearts** and 19 HP. Rejoin, save and reopen. With enough materials for either size, Half Heart should now be preselected and Full Heart should explain that only half fits. Restore the last half and reopen at ten. Check the final message, absence of purchase controls, and B's inventory and heart count.
4. Damage A before restoring. Use the included Hearts Probe in air to compare current HP and maximum HP, then heal naturally to see the HUD ceiling. Compare the HUD against the host's `native_health_verified` readback. Reconciliation can take up to 60 ticks. Repeat a reduced-cap join with Health Boost in a cheats-enabled test copy.
5. Hold Use, switch sizes, dismiss, reopen and try consecutive button presses. Check for a single debit per confirmed purchase. With A's form open, have B remove the table. In a separate attempt, have the host change the preset. Verify the stale choice spends nothing. Repeat with a disconnection. Check a previously crafted 0.4.2 heart in an upgraded copy and verify that the ordinary crafting book offers only the table recipe from this recovery system.
6. Die through elimination. Check Spectator on respawn, reconnect and world reopen. Confirm the guest keeps their own progression. In a cheats-enabled fixture the host can reset one online target with `/waveform:reset_lives @s`. For fast setup, use `/give @s waveform:reanimation_table`, vanilla material IDs and `/give @s waveform:hearts_probe`.

### Difficulty checks

1. In a cheats-off Windows world with experiments off, verify the host can view settings, select each preset, and edit each value. Try `-1`, `1201`, and a fractional value. Try raising Easy above Normal and lowering Normal below Easy. Verify that each rejection preserves every saved value. Have a normal guest attempt both write commands and confirm the host's view stays the same.
2. In the fixture world, give two players enough deficit and materials for multiple recoveries. Select Hard and set it to 100 ticks. Recover as player A and verify player B can recover during A's cooldown. Close A's confirmation and reopen the table. Check that Restore stays disabled during the short wait, enables on the first refresh after the deadline and spends nothing until pressed. Compare the new balance with the host log's `recoveryTick` and `state.recoveryReadyAt`.
3. Edit Hard and switch to Normal while an issued cooldown is active. Verify the existing deadline and the duration of the next successful recovery. For save/reopen, use a longer fixture such as 1,200 ticks, save while the wait is still active, then view the saved selection and all values after reopening. Check the player's remaining cooldown and confirm Normal starts no new wait at its default value.
4. Confirm progressive hunger starts OFF. Turn it ON, switch presets, die, recover at the table, and save and reopen. Compare the saved target with the probe's native food maximum of 20. Turn the preference OFF again. Check ordinary eating, sprinting and regeneration in both modes and guest denial of the hunger command.

## PS5 guest test

1. With separate signed-in Microsoft accounts and online play enabled, join an unmodified Windows-hosted world from PS5 via **Play → Friends** or an invite. Enable **Require players to accept resource packs to join** on the disposable pack world. Join it via the same route and accept its resource download.
2. As a normal member, open the table with **L2** while holding a material. At your usual TV distance and UI scale, check all three icons and the complete **Ready** and **Need** labels, including the last digit. Check the focus order, any scrolling and Back. Change size with the controller. Check that the ingredient rows cannot be activated and that Restore can be activated only when ready. Run both purchases, check the updated totals, and test simultaneous host and guest use at one table.
3. As host, select Hard. Verify that the guest can use the station during the host's cooldown and cannot change difficulty. Check the guest's countdown, rejoin, elimination and host save/reopen. Record both game builds, any resource or form errors, HUD screenshots and the Windows Content Log.

## Build and validation

Every release takes its version from `package.json`. The build generates the exported names `Hearts & Lives v<version> (Behaviour)` and `Hearts & Lives v<version> (Resources)` and writes `dist/hearts-and-lives-v<version>.mcaddon`. Keep the lockfile, numeric pack and module versions, and the resource-pack dependency in sync with the release. Validation rejects a mismatch and checks both nested packs in the versioned archive.

Use Node.js 24 and Python 3.10 or newer (`python` on Windows, `python3` on Linux and macOS). From this directory run `npm ci`, `npm run build`, and `npm run validate`. Validation type-checks against the pinned stable API, runs logic and mocked adapter tests, and checks the 20 health groups against the pinned vanilla player, pack versions and identities, exact recipes, the table's self-drop, textures, scripts and both nested archives. Visual sign-off for v0.5.3 still requires the Windows and PS5 checks above. [Release handover](HANDOVER.md)
