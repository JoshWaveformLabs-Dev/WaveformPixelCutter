# Falling Trees — Feature Brief (Draft)

Status: Proposed for the **full Minecraft Bedrock Survival Overhaul** only. Not part of the standalone Hearts & Lives release. No implementation yet.

## Player experience
- With tree physics enabled, using an axe to fell a naturally generated tree near its base causes a visible trunk-and-canopy tipping/falling animation, rather than instantly removing every block.
- After landing, recover logs and appropriate tree drops, with survival balance similar to the harvested tree.
- Larger trees should require more chopping effort than small trees, but avoid repetitive manual cleanup.
- Add a separate World Settings toggle, initially enabled on Normal and harder presets, disabled if performance is poor.

## Safety and compatibility
- Never fell structures made of player-placed logs or blocks, including bases, barricades and decorative trees; use conservative natural-tree recognition and reject ambiguous cases.
- Do not destroy protected structures, stored items, the Home Table or custom blocks as collateral damage.
- Limit scan radius, number of processed blocks, active animations and simultaneous falling trees for mobile/PS5 clients.
- Account for other players chopping trees simultaneously, unloaded chunks, weird tree geometries, and exceptionally large/mixed trees.
- No experimental/Preview-only dependencies in a release, unless specifically justified and separately approved.

## Feasibility gate before coding
- Verify current retail Bedrock Script API block-break hooks, reading and safely changing blocks, and supported custom entity/model animation mechanisms from official docs.
- Prototype one vanilla oak tree and one two-player Windows-host/PS5-client scenario; measure visual sync and performance.
- Evaluate all standard Overworld trees, mangroves, giant trees, special cases, drops, tool durability and enchantment behaviour.
- If believable full-trunk falling cannot be achieved reliably, retain ordinary chopping by default until it is solved; do not silently substitute instant tree-capitator as the promised effect.

## Documentation references to check during implementation
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/documents/entitymodelingandanimation?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/documents/animations/animationsoverview?view=minecraft-bedrock-stable

This is a design brief, **not** a verified technical specification or PS5 compatibility certification.
