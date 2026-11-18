# Reanimation Table V2 handover

[Hearts & Lives 0.5.0](dist/hearts-and-lives-dev.mcaddon) builds on `feature/hearts-native-health` at `5916002`. The user confirmed ten starting lives and hearts, a one-life and one-native-heart loss per death, the shrinking vanilla HUD and persistent Spectator elimination after ten deaths on retail Windows in 0.4.2.

## Recovery

The table opens on an empty-hand use. A native form displays ingredient images, owned and required counts, shortfalls and two recovery buttons. It reads native maximum health independently of saved lives. Each grant spends the selected recipe from the initiating player's hotbar and backpack and runs the existing native-health reconciliation immediately. The original player definition, saved-life format, world properties, pack UUIDs and optional hunger preference are retained. Previously crafted Artificial Hearts remain redeemable.

Only Normal material prices have approval. Easy, Hard and Extreme currently point to those prices. Host-only preset and cooldown commands retain their existing behavior. [Recipe data](src/recovery-materials.ts) · [Player guide and prices](README.md#using-the-station)

## Retail API

Bedrock 26.60 shipped stable server 2.11.0 and server-ui 2.3.0. The station uses `CustomForm` with labels, images, server-updated observables and disabled native buttons. Inventory payment occurs on the host after selection. The three ingredient textures ship in the world resource pack under its own UUID. [Retail release notes](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog) · [CustomForm reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/customform?view=minecraft-bedrock-stable) · [Mojang texture source](https://github.com/Mojang/bedrock-samples/tree/15701fa9c13923f12662984c32c124327e40e3d3/resource_pack/textures/items)

## Save behavior

One session per player accepts one selection. Selection rechecks the placed block, six-block proximity, dimension, life state, cooldown, host settings and inventory. A synchronous transaction verifies each affected slot and the saved grant. Confirmed failures refund the exact debits, including partial stacks. If a storage read cannot establish whether a grant committed, the host receives an error. Bedrock saves inventory and world properties separately, so a hard process shutdown between writes can leave a mismatch. Native health retries use the committed balance and never charge again.

## Validation

All 88 automated tests passed against the local build and again against the scripts extracted from the delivered add-on. The packaged player definition, native-health script, life state and store, recovery clock and difficulty command script were byte-identical to their 0.4.2 counterparts. The suite covers recovery sizes, four presets, shortages, multiplayer isolation, native maximum and injury preservation, held input, dismissals, cooldown expiry while open, stale forms and partial payment failures. The packager verifies both nested archives, the 20 native health groups, preserved pack identities, the table recipe and drop, and the UI scripts and images.

Physical acceptance of the 0.5.0 form remains open on Windows and a stock PS5 guest. Check icon rendering, controller navigation, the 16 → 18 → 19 → 20 HP sequence, both inventories and save/reopen. [Windows test](README.md#windows-test) · [PS5 guest test](README.md#ps5-guest-test)
