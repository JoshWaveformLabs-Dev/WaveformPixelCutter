# Hearts & Lives development add-on

Hearts & Lives **0.3.0** introduces the Reanimation Table for retail Bedrock **26.60** with stable `@minecraft/server` **2.11.0**. Importing the development build upgrades the existing pack IDs and includes the Hearts Probe and its commands. [Download Hearts & Lives 0.3.0](dist/hearts-and-lives-dev.mcaddon) · [Standalone Hearts Probe 0.1.0](dist/hearts-probe.mcaddon)

Players begin with 10 lives and logical capacity for 10 hearts and 10 hunger icons. Death removes one of each. At zero lives the player enters Spectator on respawn and stays eliminated across reconnects. At a Reanimation Table, an Artificial Heart restores one of each and a Half Artificial Heart restores half of each. Recovery consumes one item from the selected stack on success. A player keeps the heart if the grant would exceed 10 or if they are eliminated. Chat reports the balance on spawn and recovery. Native health, hunger and HUD capacity are independent of this accounting.

## Reanimation Table

In a disposable test world with cheats enabled, the host can obtain the table and a recovery test kit with these commands. The table has no crafting recipe in this build.

```text
/give @s waveform:reanimation_table 1
/give @s waveform:artificial_heart 3
/give @s waveform:half_artificial_heart 3
```

Place the table. Select a full or half heart in the hotbar, aim at the placed table, and press **Use/Interact** once. The default is right-click on Windows and L2 on PS5. Release the button before the next interaction. Recovery applies to the player using the table. The host can hand a test kit to a normal guest.

## Recipes

Use a crafting table. **D** is a diamond, **N** is a netherite ingot, **H** is a Heart of the Sea, and **·** is empty. A diamond unlocks each recipe.

| Item | Rows, top to bottom | Cost |
| --- | --- | --- |
| Artificial Heart | `DND` / `DHD` / `DND` | 6 diamonds, 2 netherite ingots, 1 Heart of the Sea |
| Half Artificial Heart | `DN` / `DH` / `D·` | 3 diamonds, 1 netherite ingot, 1 Heart of the Sea |

Each recipe yields one item. Use the crafted heart at the Reanimation Table.

## Windows test

1. In retail Minecraft for Windows, enable **Content Log File** under **Settings → Creator** and use **Info** or **Verbose** logging. Import the development `.mcaddon` and activate both Hearts & Lives packs in a disposable Survival world. Keep all experiments off. Record the exact game build, pack versions and cheats setting. Use a cheats-enabled test copy for the `/give` fixture and host commands.
2. Confirm the Reanimation Table name, inventory icon, placed appearance and normal placement in Survival. Check both heart recipes for unlock, exact costs, output names and icons, and the absence of a full-to-half conversion. With two players online, bring player A to 8 lives by dying twice, while B remains at 10. On respawn, use a heart in empty air, on another block, and then at the table. Each of the first two attempts should leave the balance at 8 and the stack intact. At the table, one full heart should take A to 9. A half heart should take A to 9½. At 9½, verify the full heart is retained, then use a half heart to reach 10. Verify both hearts are retained at 10 and B remains at 10 throughout.
3. With enough deficit and at least two hearts in the selected stack, hold Use/Interact on the table. Expect one debit and one grant. Release and press again to test a second grant and consumption of the last item. Try an empty hand, a different item, quick slot changes, dropping the item, and breaking the table during an interaction. Match each successful recovery log to its player, debit and grant. Use a v0.2.0 world copy with a known reduced balance to check that upgrading preserves the existing record and enables table recovery. Verify the item count and balance after a graceful save and reopen.
4. Repeat a death followed by a rejoin, a disconnect on the death screen, and a non-player death. Check the `[Hearts & Lives]` log for player IDs, one deduction per player death and correct spawn balances. At zero, verify Spectator immediately on respawn and after rejoin and world reopen. Attempt table use as the eliminated player and verify the other player can still play. In a cheats-enabled copy, the host can run `/waveform:reset_lives @s` or target exactly one online player by name. Reset restores all three balances and returns a Spectator target to Survival after verifying the saved state. Check that normal members are denied this command.
5. Use **Hearts Probe** (`waveform:hearts_probe`) while aiming into empty air. Check the action bar and `[Hearts Probe]` log for native attributes. In a cheats-enabled copy the host can run `/waveform:set_current health 18` or `/waveform:set_current hunger 18` to test the current-value readback.

## PS5 guest test

1. With separate signed-in Microsoft accounts and online play enabled, join an unmodified Windows-hosted world from PS5 via **Play → Friends** or an invite. Enable **Require players to accept resource packs to join** on the disposable pack world. Join it via the same route and accept its resource download.
2. As a normal guest in Survival, verify the Reanimation Table and all three item names and icons. Receive a kit from the host. Use a full and half heart at the placed table with **L2** by default. Repeat the Windows checks for air and other blocks, hold and release, a last item, and the half-unit restriction at 9½. Confirm the guest's balance, inventory and chat feedback against the host log. Switch which player recovers while watching the other player's balance to verify multiplayer isolation.
3. Use the Hearts Probe with L2 while aiming into empty air, then repeat the guest death, elimination, leave/rejoin and host save/reopen cases. Record both retail builds, pack versions, join or resource errors, screenshots and Windows logs.

## Build and validation

Use Node.js 24 and Python 3. From this directory run `npm ci`, `npm run build`, and `npm run validate`. Validation compiles and type-checks against the pinned stable API, runs logic and mocked adapter tests, and verifies the pack manifests, UUIDs, recipes, block resources, textures and nested archives. Windows and PS5 gameplay tests are pending. [Session handover](HANDOVER.md)
