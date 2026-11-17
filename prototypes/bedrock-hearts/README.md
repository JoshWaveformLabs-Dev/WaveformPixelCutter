# Hearts & Lives development add-on

[Download the development add-on](dist/hearts-and-lives-dev.mcaddon). It contains both pack versions **0.2.0** for retail Bedrock **26.60** and stable `@minecraft/server` **2.11.0**. The standalone [Hearts Probe 0.1.0](dist/hearts-probe.mcaddon) is the previous build. The development pack upgrades the same pack IDs and includes the probe and its commands.

Players begin with 10 lives and logical capacity for 10 hearts and 10 hunger icons. Death removes one of each. At zero lives the player enters Spectator on respawn and stays eliminated across reconnects. Artificial Hearts restore one of each and Half Artificial Hearts restore half of each. A heart is rejected intact when any grant would exceed 10 or when the player is eliminated. State is reported in chat on spawn and recovery. Native health, hunger and HUD capacity are independent of this accounting.

## Recipes

Use a crafting table. **D** is a diamond, **N** is a netherite ingot, **H** is a Heart of the Sea, and **·** is empty. A diamond unlocks each recipe.

| Item | Rows, top to bottom | Cost |
| --- | --- | --- |
| Artificial Heart | `DND` / `DHD` / `DND` | 6 diamonds, 2 netherite ingots, 1 Heart of the Sea |
| Half Artificial Heart | `DN` / `DH` / `D·` | 3 diamonds, 1 netherite ingot, 1 Heart of the Sea |

Each craft yields one item. There is no conversion recipe. Use an ordinary stackable heart from the selected hotbar slot and aim into empty air. Script checks the live slot against the event's stack before committing the debit.

## Windows test

1. In retail Minecraft for Windows, enable **Content Log File** under **Settings → Creator** and use **Info** or **Verbose** logging. Import the development `.mcaddon`, activate **Hearts & Lives (Behavior)** and **Hearts & Lives (Resources)** in a disposable Survival world, and keep all experiments off. Record the exact game build, pack versions and cheats setting.
2. Join with two players. Confirm both start at 10. Die with one, respawn, then leave and rejoin. The other player should stay at 10. Repeat with a disconnect on the death screen, a non-player death, and a graceful save and reopen. Check the `[Hearts & Lives]` log for player IDs, one deduction per death and correct spawn balances. Exercise different causes, including immediate respawn if enabled.
3. Check recipe unlock, exact input costs, output names/icons, and absence of a full-to-half conversion. At 8 lives, use one full and then one half heart to reach 9 and 9½. Try a full heart at 9½ and confirm the count stays unchanged. Use a half heart to reach 10. Test a stack and its last item, repeated presses, holding Use Item, and quick swaps or drops. Verify each grant and debit, including after save/reopen. Default keyboard/mouse Use Item is right-click.
4. Reach zero and verify Spectator immediately upon respawn and after rejoin and world reopen. Try interaction and recovery as that player and confirm the other player can still play. In a cheats-enabled test copy the host can run `/waveform:reset_lives @s` or target exactly one online player by name. Reset restores all three balances and returns a Spectator target to Survival after verifying the saved state. Normal members must be denied the command.
5. Use **Hearts Probe** (`waveform:hearts_probe`) to compare the separate native attributes with the logical values. Right-click while aiming into empty air and check the action bar and `[Hearts Probe]` log. In a cheats-enabled copy, the host can still run `/waveform:set_current health 18` or `/waveform:set_current hunger 18` for a current-value readback. Neither command changes native maximum capacity.

## PS5 guest test

1. With separate signed-in Microsoft accounts and online play enabled, join an unmodified Windows-hosted world from PS5 via **Play → Friends** or an invite. Use that same route for the pack world and accept its resource download. Enable **Require players to accept resource packs to join** on the host world.
2. As a normal guest, verify all three names and icons. While aiming into empty air, use the probe and a crafted heart with **L2** by default. Check the guest feedback, host log attribution, balance and inventory. Repeat the two-player death, elimination and rejoin cases. Record both retail builds, join/resource errors, screenshots and Windows logs.

## Build and validation

Use Node.js 24 and Python 3. From this directory run `npm ci`, `npm run build`, and `npm run validate`. Validation compiles and type-checks against the pinned stable API, runs logic and mocked adapter tests, and verifies pack manifests, UUIDs, recipes, textures and both nested archives. See the [session handover](HANDOVER.md) for runtime gates. Windows and PS5 gameplay tests are pending.
