# Hearts Probe

Retail target **Bedrock 26.60**, pack version **0.1.0**, and stable **`@minecraft/server` 2.11.0**. The [installable add-on](dist/hearts-probe.mcaddon) contains both packs. The test item is **Hearts Probe** (`waveform:hearts_probe`), with a red heart and cream pulse trace.

Using the item reads player attributes. The action bar shows health and hunger as current/effective maximum, plus current saturation, exhaustion, and sprint state. The host content log records tick, event sequence, player name and world entity ID, and full-precision readings. A missing component appears as `n/a` on screen with a reason in the log. The script logs world load and player spawn as well as item use.

## Minecraft for Windows

1. Record the retail game build, pack versions and experiment settings. In **Settings → Creator**, enable **Content Log File** and use **Info** or **Verbose** logging. Open `hearts-probe.mcaddon` with Minecraft for Windows and confirm both imports.
2. Create a disposable Normal Survival world with all experiments off. Activate **Hearts Probe (Behavior)** and confirm **Hearts Probe (Resources)** is also active. With cheats off, open and reopen the world. Check for one `[Hearts Probe]` `world_load` marker per load and zero add-on errors. Keep an unmodified Normal Survival world for the cross-play control.
3. Stock two probes for the host and guest. Search **Hearts Probe** in Creative inventory, or use `/give @s waveform:hearts_probe 2` while provisioning a disposable world with cheats enabled. Return to Survival and turn cheats off before the read-only test. Select the probe, aim into empty air, and tap **Use Item** (right-click by default). Check the name, icon, action bar and one `item_use` record for that press. Try a second sample after taking ordinary damage and after sprinting or eating. Check the player identity and compare both native meters with the readings.
4. In a separate Survival copy with cheats enabled, run `/waveform:set_current health 18` and `/waveform:set_current hunger 18` as the Windows host. Each command writes the selected **current** stat once and logs immediate `before` and `after` readings for both stats. Compare the empty or partial icons and effective maxima with the full baseline. Repeat at 19 points and again at 2 hunger points. Try an out-of-range request such as `/waveform:set_current health 0` and check that it is rejected. Observe ordinary healing and eating, then sample after respawn and world reopen. The game can update current values immediately during play. Use the logged readback to assess the write.

## PS5 joining the Windows host

1. Record the PS5 retail build. Use separate signed-in Microsoft accounts with cross-platform multiplayer allowed, and a PS5 account with online play access. Add each other as Minecraft friends. Join the unmodified Windows world from **Play → Friends** or the host invite and record the control result.
2. On Windows, open the pack world with multiplayer enabled and **Require players to accept resource packs to join** selected. On PS5, join by the same friends or invite route and accept the resource download when prompted. Record any join or download error exactly as displayed.
3. Have the host hand the probe to the guest as a normal member. On PS5, verify the icon and exact name. Select it, aim at empty air and tap **Use Item** (**L2** by default). Check that the guest gets the action bar and the Windows content log shows one `item_use` with the guest's name and ID. Repeat as host to verify attribution. Capture the HUD and keep the matching host log. No console pack import is needed for this route.

## Build and evidence

From this directory, use Node.js and Python 3:

```sh
npm ci
npm run build
npm run validate
```

Automated checks passed for strict TypeScript compilation and type-checking against the pinned stable declarations, all six diagnostic logic tests, and static pack validation. Validation checks the pack JSON, UUIDs, pack linkage, stable module version, item texture mapping, and both nested `.mcpack` archives against the compiled payload, including ZIP CRCs. Minecraft for Windows and PS5 gameplay cases remain unrun.

Stable maximum health, maximum hunger and native HUD capacity setters are unavailable. The current-value command can help observe the meters but cannot pass the native-cap **H1** and **F1** gates. Retail import, item input and rendering, actual setter readback, and private resource delivery to PS5 remain hardware checks. See the [prototype test plan](../../docs/hearts-prototype-test-plan.md).
