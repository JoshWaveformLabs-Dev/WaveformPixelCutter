# Session 004 native cap handover

Use **Native Health Probe** and **Native Hunger Probe** version `0.1.0` in separate disposable Survival worlds. Activate only the corresponding behavior pack in each world. Both packs define `minecraft:player`, so a stacked test would depend on pack priority. The baseline is Mojang retail Bedrock 26.60 (`v1.26.60.5`) with stable `@minecraft/server` `2.11.0`. Windows and PS5 runtime results are pending. [Native Health download](dist/native-health.mcaddon) · [Native Hunger download](dist/native-hunger.mcaddon)

## Controls and evidence

Enter commands in Chat and Commands. Each command targets the issuing player and is intended for normal members with cheats off.

| Control | Health | Hunger |
| --- | --- | --- |
| Request native component group | `/nativehealth:cap N` (20, 18, 19, 10, 2) | `/nativehunger:cap N` (20, 18, 10, 6, 2) |
| Read native attributes | `/nativehealth:status` | `/nativehunger:status` |
| Set current value for a control or fixture | `/nativehealth:current N` | `/nativehunger:current N` |
| Ask the attribute API to refill to its maximum | `/nativehealth:fill` | `/nativehunger:fill` |
| Dispatch group removal | `/nativehealth:reset` | `/nativehunger:reset` |
| Set current health for the regeneration fixture | | `/nativehunger:health 12` |

Retain the Windows content log from import through world exit. The probes intentionally emit `[NativeCaps]` records at warning level. These include the pack, tick, player ID/name, current value, `effectiveMax`, `effectiveMin`, and `defaultValue` of available health, hunger, saturation and exhaustion attributes. They capture command outcomes and immediate, one-tick and 20-tick observations, initial join/rejoin versus respawn, and hunger-pack sprint transitions. Record missing attributes, errors and exact game and pack versions with screenshots or video. Use IDs to correlate observations within the same world.

`cap` dispatches an entity event. A call that returns successfully still needs the subsequent observations below. `reset` removes groups and can remove their components, so use a fresh untouched player or world for the pre-event control. A fresh control also avoids residual saturation, effects and prior group state. [Entity event and group semantics](https://learn.microsoft.com/en-us/minecraft/creator/documents/entitybehaviorintroduction?view=minecraft-bedrock-stable)

## Windows retail procedure

1. In Minecraft for Windows, enable **Content Log File** under **Settings → Creator**. Note the exact log path shown in the profile or Content Log History. A typical retail directory is `%APPDATA%\Minecraft Bedrock\logs\`. Keep file logging enabled and turn off the Content Log GUI during HUD captures so warning overlays stay out of the screenshots. Record exact game build and pack version, and copy the complete log including warnings during import, world load and event dispatch. [Content Error Log](https://learn.microsoft.com/en-us/minecraft/creator/documents/contenterrorlog?view=minecraft-bedrock-stable)
2. Open each `.mcaddon` with Minecraft. Make a fresh vanilla control world and a separate world for each pack. Activate the chosen pack under **Behavior Packs → My Packs**. Use Survival, Normal difficulty, natural regeneration enabled, default HUD, and all experiments off. Start with cheats off and without status effects, absorption, or custom UI packs. On first spawn run `status` for the active pack. Capture whether the pack loaded and the command registered. Preserve exact schema or component errors even if the script starts. Run the health world independently if hunger import or load fails.
3. For each pack, complete the current-only control, cap sequence, and lifecycle checks below. Wait for the delayed trace and retake `status` before changing inputs. With two players online, leave B at 20 while A changes cap, then change B to a different cap and retest A. Record both players' attributes and native HUD after each action.
4. With A at 18 and B at a different known state, log both players. Have only A die in normal Survival play and respawn. Capture spawn trace and `status` for both before any reapplication. Repeat with A leaving/rejoining and after a graceful host save/close/reopen. Record the first and settled maxima, IDs, and HUD. After each observation, request 18 again if needed to test recoverability. The script observes these transitions without reissuing a cap.
5. If `triggerEvent` is unavailable or errors, test `/event entity @s nativehealth:cap_18` or `/event entity @s nativehunger:cap_18` as the host in a **separate cheats-on copy**, with experiments off. Take `status` before and after if script registers. Preserve both event outcomes and label the evidence from this copy. A failing command lookup, missing script or rejected player definition leaves the corresponding runtime question open.

### A. Health

1. In the health world before its first cap event, verify `effectiveMax` 20. Run `/nativehealth:current 18`, then `/nativehealth:status`. Capture the HUD promptly. With current 18 at a max of 20 the expected control is nine full hearts and one empty heart. Repeat at 19 if practical. Use fully healed vanilla screenshots as a second reference.
2. Request **20 → 18 → 19 → 10 → 2 → 20**. For each value save the `cap` traces before and after dispatch, then run `fill` and capture `status` and a HUD screenshot. Record the requested value, measured `effectiveMax`, `defaultValue`, and full-health current. Expected even capacities are 10, 9, 5 and 1 heart slots at 20, 18, 10 and 2. At 19 record nine full hearts plus a half heart at full health, and compare the final slot with the current-19 control.
3. At each reduced setting, take safe ordinary damage and heal with stocked food and natural regeneration or a healing potion. At 2 use a verified nonlethal one-point hit or `/nativehealth:current 1` as the damage fixture. Wait for healing to settle, then record the full value and HUD again. The refill ceiling must match `effectiveMax`, including through ordinary healing. In the even-cap states, compare full and damaged screenshots for the count of all outlines, including empty ones. At 19 the engine can report an odd maximum even if the HUD art resembles the current-19 control. Record visual ambiguity separately.

### B. Hunger

1. Collect `status` before the first cap event. Compare fresh-world food eligibility and sprint behavior with vanilla. Keep a second fresh Native Hunger world with groups untouched for comparisons that need `/nativehunger:current N`. Check sprint entry with short attempts on flat ground at 20, 18, 10, 7, 6, 5 and 2. Narrow around the observed change if needed. For sprint continuation, hold the sprint input on an unobstructed route and allow native exhaustion to cross the cutoff. Record before/after status and the transition trace. Keep the input, terrain, difficulty, and measured saturation/exhaustion comparable.
2. Request **20 → 18 → 10 → 6 → 2 → 20**. Record any unknown component, rejected field, ignored event, missing attribute, or absent startup. At each setting take `status` after `cap` and `fill`, and capture the entire native food bar. Expected full capacities if the HUD follows the engine are 10, 9, 5, 3 and 1 slots. Compare a lower current under the pre-event 20 maximum to the same current under the candidate maximum, including all empty slot outlines.
3. For every cap, try to eat ordinary food at measured full hunger. Then use `current` to go below the cap and eat ordinary food with a refill large enough to cross it, such as cooked beef. Record input and item count, whether eating completes, and current, maximum, saturation and exhaustion before and after. Check the ceiling through food as well as `fill`. Full-player refusal of ordinary food can be compared with full vanilla, and saturation/refill can be compared at matched reachable current values.
4. At each verified cap, try to start a sprint when filled and sustain it until food declines. For regeneration, set current health to 12 using `/nativehunger:health 12`, remain still for at least 20 seconds, and compare `status` before and after at each filled cap. Repeat both checks in the no-group world at the same actual hunger and comparable saturation/exhaustion. If the control requires more than 6 points to start sprinting and at least 18 for natural healing, expect capped-full players at 6 and 2 to have no sprint access and players at 10, 6 and 2 to lack natural healing. Report the measured thresholds and any behavior differing from the control.

## PS5 guest procedure

1. Use the retail game on both devices, separate Microsoft accounts added as friends, and enabled cross-network online play on both accounts. Sign in to PlayStation Network on PS5 with online multiplayer available. On Windows enable **Multiplayer Game** with friends allowed. Join the vanilla control world first from PS5 using **Play → Friends** or a host invite. Record both exact game builds and whether the baseline join works.
2. Host the health world and then the hunger world. In each world wait for Windows startup and baseline status. Join via the same route as a normal PS5 member and accept any world-content prompt. Copy any connection or pack error exactly. Use the controller binding for **Chat and Commands** and enter the test commands on PS5. Verify host log entries carry the PS5 player's ID and name. Capture the guest's native HUD from the console.
3. Repeat the Windows cap and visible slot checks for the guest. Hold Windows at 20 while changing PS5, then change Windows while holding PS5 at a distinct cap. Exercise ordinary eating with the controller, sprint entry and continuation, and low-cap regeneration in the hunger world. Repeat PS5 death/respawn, leave/rejoin, and rejoin after Windows saves and reopens. Gather Windows logs and screenshots from both clients. Record a join failure separately from in-world cap or HUD observations.

## Decision after retail testing

For each cap, record **builds, pack version, world, player ID, event outcome, current/effectiveMax/defaultValue at each checkpoint, natural refill ceiling, actual HUD outlines, effects on gameplay, and outcome after respawn/rejoin/reopen**. Use this evidence to make the following decisions independently for health and hunger.

| Observation | Engineering recommendation |
| --- | --- |
| Wrong build, script fails to load, event unavailable, or pack override is rejected | Diagnose the exact import, schema, script or event failure against the pinned retail build. A confirmed unknown/rejected hunger definition rules out this JSON candidate. An unavailable test remains inconclusive about other mechanisms. |
| Event runs and current drops, while `effectiveMax` stays at 20 or ordinary refill passes the request | Reject the candidate as a genuine native cap on that build. Keep the live progression model and revisit the exact-design requirement before choosing a fallback. |
| `effectiveMax` tracks the request and ordinary refill respects it, with vanilla-size or ambiguous HUD | Record the native cap separately from the presentation result. Keep the native HUD requirement open for unverified capacities. |
| Cap and HUD work, but another player changes or lifecycle clears the cap | Treat cross-player leakage as a blocker. If only lifecycle resets are observed, investigate reliable per-player reapplication in a future isolated test and measure the time before Survival resumes. |
| Hunger works but low caps impede sprinting, eating or natural regeneration | Use the measured control comparison to distinguish retained vanilla thresholds from changed rules. Obtain agreement on the low-cap gameplay before integration. |
| Windows succeeds and PS5 cannot join or differs in gameplay or HUD | Keep the Windows finding and leave cross-platform release blocked. Reproduce with the matched-build vanilla control and the relevant pack alone. |
| One experiment passes and the other fails | Retain the passing mechanism as a candidate for its own stat. Keep the coupled health/hunger design unapproved. |
| Both pass with per-player behavior, ordinary refill ceilings and native HUD on both clients | Proceed only to a separately scoped compatibility test with one combined player definition, retail update regression and lifecycle coverage. One validated retail build establishes behavior for that build. |

## Build and automated validation

Use Node.js 22.15+ on the 22.x line or Node.js 24, plus Python 3.10+. Run these commands from this prototype directory.

```sh
npm ci
npm run build
npm run validate
```

Strict TypeScript compilation, **5 mocked probe tests**, and static archive validation of both `.mcaddon` files passed. The archive checks cover the baseline digest, pack isolation, UUIDs, event wiring, stable manifest dependencies, and nested ZIP contents. The existing **30 Hearts & Lives regression tests** passed. These results establish source and package integrity. Retail cap changes, food rules, HUD, and cross-play still require the procedures above.

## Sources

- The vendored baseline is byte-for-byte Mojang retail `v1.26.60.5` at `15701fa9c13923f12662984c32c124327e40e3d3`. [Upstream player.json](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/behavior_pack/entities/player.json) · [Vendored player.json](vendor/player.json) · [Upstream terms](vendor/LICENSE.md)
- Entity events support ordered component-group operations and apply changes when the affected entity ticks. `minecraft:health` documents `value` and `max` for entities. The retail entity schema lists `minecraft:player.hunger` as a dynamic value. Its `value`/`max` fields and use in player component groups remain undocumented. The stable Script API exposes hunger as an attribute for observation. [Entity Events](https://github.com/MicrosoftDocs/minecraft-creator/blob/80b7b1713df821debb4a8022e32e6b0ad840a273/creator/Documents/EntityEvents.md) · [Health JSON](https://github.com/MicrosoftDocs/minecraft-creator/blob/80b7b1713df821debb4a8022e32e6b0ad840a273/creator/Reference/Content/EntityReference/Examples/EntityComponents/minecraftComponent_health.md) · [Retail hunger schema entry](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/json_schemas/server/entity/1.26.30/Entity%20component%20definitions.json#L1200-L1202) · [Retail script module metadata](https://github.com/Mojang/bedrock-samples/blob/15701fa9c13923f12662984c32c124327e40e3d3/metadata/script_modules/%40minecraft/server_2.11.0.json) · [Stable 2.11.0 declarations](https://registry.npmjs.org/@minecraft/server/-/server-2.11.0.tgz)

The [feasibility review](../../docs/hearts-feasibility.md), [prototype test plan](../../docs/hearts-prototype-test-plan.md) and [Hearts & Lives handover](../bedrock-hearts/HANDOVER.md) describe the preceding milestones.
