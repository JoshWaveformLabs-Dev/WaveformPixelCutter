# Native health milestone

Hearts & Lives **0.4.2** upgrades the 0.4.1 packs in place using their existing UUIDs. The Windows development add-on includes both packs, the approved recipes, the Reanimation Table and the built-in Hearts Probe. [Development build](dist/hearts-and-lives-dev.mcaddon) · [Windows and PS5 test steps](README.md#windows-test)

## Saved progression and native health

- Each player begins at 10 lives and 20 HP. The player's saved heart units select one of 20 exclusive native health groups. Death costs 2 units. Full and half hearts restore 2 and 1 at the table. Zero lives uses Spectator. A legacy living record with zero heart units uses a nonlethal 1 HP floor.
- Spawn, reconnect, world load, verified table grants and host test resets reconcile from the world record keyed by player ID. The Content Log records the measured maximum. Unconfirmed boundaries retry in order. Native retries never repeat an inventory debit. A world shutdown during a storage failure can lose an in-memory retry, and Bedrock saves inventory and dynamic properties separately.
- The world keeps its existing player records, cooldowns, preset migrations and behavior-pack identity. A separate world boolean stores the host's hunger preference. It defaults OFF. ON displays an intended target derived from the saved hunger balance. Gameplay uses vanilla hunger in both modes.

## Automated evidence

Stable API type-checking, 81 add-on tests, and nested archive validation passed. The same 81 tests also passed against scripts extracted from the delivered archive with mock entity events resolved from its actual player definition. Five standalone probe tests and both diagnostic archive checks passed in a temporary copy. The approved recipes and standalone diagnostic payloads match the development base.

If native HP becomes unreadable across a group swap, the log flags an uncertain refill. The script leaves later current HP alone once it can no longer distinguish a refill from ordinary healing.

## Gameplay evidence still needed

The reported physical Windows result belongs to the standalone Native Health Probe. The native maximum fell from 20 to 10, the HUD showed five hearts, and fall death followed by respawn preserved both. The integrated pack awaits physical testing.

1. On Windows, import into a disposable Survival world or upgrade a copy. Follow the 20, 16, 18, 19, 20 HP sequence in the README. Record current HP, measured maximum and HUD screenshots, both players' IDs, inventory counts, rejoin and save/reopen results. Check the final half-life, Spectator, injury preservation and natural healing.
2. On a stock PS5, join the Windows host as a normal member, accept the resource pack and repeat the same transitions with L2. Compare each player's HUD against their own readings in the host log. Check that the guest cannot edit settings.
3. Native hunger needs a separate retail probe world. Measure maximum and current food, HUD, eating/refill, sprint threshold and natural regeneration through death, reconnect and reload. Establish even and odd capacities and multiplayer isolation on Windows and PS5 before enabling enforcement. [Standalone hunger test procedure](../bedrock-native-caps/HANDOVER.md)
