<div align="center">

# ❤️ Hearts & Lives

### Every death costs you a heart. Every life matters.

A survival add-on for **Minecraft: Bedrock Edition**. You get ten lives and ten hearts. Each death permanently shrinks your heart bar, and only the **Reanimation Table** can win them back.

![Version 0.5.3](https://img.shields.io/badge/version-0.5.3-c62828)
![Minecraft Bedrock 26.60+](https://img.shields.io/badge/Minecraft%20Bedrock-26.60%2B-3c8527)
![Status: beta](https://img.shields.io/badge/status-beta-f9a825)
![Experiments: off](https://img.shields.io/badge/experiments-not%20required-1565c0)

**[⬇️ Download Hearts & Lives v0.5.3 (.mcaddon)](prototypes/bedrock-hearts/dist/hearts-and-lives-v0.5.3.mcaddon?raw=true)**

[Player Guide](docs/PLAYER_GUIDE.md) · [Known Limitations](docs/KNOWN_LIMITATIONS.md) · [Development](docs/DEVELOPMENT.md)

</div>

---

> [!NOTE]
> Hearts & Lives is a **Bedrock Edition add-on**. It does not work with Minecraft: Java Edition. Version 0.5.3 is a **beta**. The core life system and the Reanimation Table have been played on retail Windows. The v0.5.3 screen layout and PlayStation 5 play are still being tested. See [Known Limitations](docs/KNOWN_LIMITATIONS.md).

## ✨ At a glance

| | |
| --- | --- |
| ❤️ **10 lives, 10 hearts** | Every player starts with a full heart bar and ten lives. |
| 💀 **Deaths leave a mark** | Each death removes one life and one heart from your **real** health bar. |
| 🛠️ **Reanimation Table** | A craftable block that turns rare materials back into hearts and lives. |
| ½ **Half hearts too** | Restore a full heart or a cheaper half heart. |
| 👻 **Elimination** | Lose your last life and you return as a Spectator. |
| 👥 **Fair multiplayer** | Every player keeps their own lives, hearts and cooldown. |
| ⚙️ **Host difficulty presets** | Easy, Normal, Hard and Extreme set how long players wait between restores. |
| ✅ **No experiments** | Uses only stable Bedrock features. Cheats can stay off. |

## Contents

- [How it works](#-how-it-works)
- [The Reanimation Table](#%EF%B8%8F-the-reanimation-table)
- [Crafting the Reanimation Table](#-crafting-the-reanimation-table)
- [Installation](#-installation)
- [Playing with friends: PC and PS5](#-playing-with-friends-pc-and-ps5)
- [Difficulty settings](#%EF%B8%8F-difficulty-settings)
- [FAQ and troubleshooting](#-faq-and-troubleshooting)
- [Current release and roadmap](#%EF%B8%8F-current-release-and-roadmap)
- [Documentation](#-documentation)

---

## 🎮 How it works

**You start with 10 lives and 10 hearts.** Your heart bar is the normal Minecraft one, full and healthy.

**Every death costs one life and one heart.** You don't just respawn. You come back with a smaller heart bar, and that smaller bar is permanent until you restore it. Your lives and your maximum hearts always match.

> **Example:** Steve falls into lava twice. He now has **8 lives** and his health bar only goes up to **8 hearts**, even after eating and resting. Two heart slots are gone.

**Hearts can be restored.** Bring diamonds, netherite ingots and a Heart of the Sea to a [Reanimation Table](#%EF%B8%8F-the-reanimation-table). A full restore gives back one life and one heart. A half restore gives back half a life and half a heart.

> **Example:** Alex is down to 7 hearts. She restores a full heart (8 hearts), then a half heart. Her heart bar now holds **8½ hearts**, and she has 8½ lives.

**Lose your last life and you are eliminated.** When you run out of lives, you respawn in **Spectator** mode. You can fly around and watch your friends, but you can't play or use the table any more. Elimination survives leaving and rejoining the world.

> **Example:** Steve has half a life left and gets hit by a creeper. He respawns as a Spectator and his adventure is over.

**Every player is separate.** In multiplayer, each player has their own lives, hearts and restore cooldown. Your friend dying doesn't cost you anything, and everyone can share the same Reanimation Table.

Everything else follows normal Minecraft rules. Hunger, eating, healing and dropping your items on death are not changed by default.

---

## 🛠️ The Reanimation Table

The Reanimation Table is the only way to restore lost hearts.

| | |
| --- | --- |
| **What it does** | Swaps materials from your inventory for 1 or ½ a heart and life. |
| **Where to get it** | Craft it in Survival ([recipe below](#-crafting-the-reanimation-table)), or find it in the Creative inventory under **Items**. |
| **Placing it** | Place it like any block. Mine it to pick it up and move it. It drops itself. |
| **Sharing** | Any number of players can use the same table. Each player sees their own inventory. |

### Using the table

1. **Stand next to the table** (within about 6 blocks) and **use it**:
   - **Windows:** right-click.
   - **PlayStation 5:** press **L2** (default controls).

   You can open it with an empty hand or while holding a block, tool or material. To place a block *against* the table instead, **sneak** while placing.
2. The **REANIMATION TABLE** screen shows your hearts, for example **♥ 8 / 10 Hearts**.
3. Use the dropdown to choose **Full Heart** or **Half Heart**. The recipe updates straight away.
4. Check the three ingredient rows (explained below).
5. When the **RESTORE HEART** button lights up, press it. A short message such as **Heart restored!** shows your new total, and the screen closes after about two seconds.

### Restore costs

| Restore | 💎 Diamond | ⬛ Netherite Ingot | 🌊 Heart of the Sea | You gain |
| --- | :---: | :---: | :---: | --- |
| **Full Heart** | 6 | 2 | 1 | 1 life + 1 maximum heart |
| **Half Heart** | 3 | 1 | 1 | ½ life + ½ maximum heart |

The table takes materials from your hotbar and backpack. It does not count armour slots, your off-hand, shulker boxes or chests.

### Reading the ingredient rows

Each row shows the item's picture, how many of the recipe you've covered, and whether that row is done:

| What you see | What it means |
| --- | --- |
| <code>Diamond 6/6 - Ready</code> in **green** | You have enough. Carrying more than six still shows 6/6. |
| <code>Diamond 4/6 - Need 2</code> in **red** | You have 4 of the 6 needed. Find 2 more. |
| **Netherite** | Short label for Netherite Ingot. |
| **Sea Heart** | Short label for Heart of the Sea. |

The words **Ready** and **Need** carry the same meaning as the colours, so you don't need colour vision to read them. Counts refresh every second while the screen is open.

### When you can't restore yet

| Situation | What the table does |
| --- | --- |
| Not enough materials | The row shows **Need**, and **RESTORE HEART** stays greyed out. Nothing is taken. |
| Only half a heart missing | Opens on **Half Heart**. A full restore shows *Only half a heart will fit.* |
| All 10 hearts | Shows **ALL HEARTS RESTORED!** with no restore button. |
| Restore cooldown active | Shows *Try again in N seconds.* See [Difficulty settings](#%EF%B8%8F-difficulty-settings). |
| You walk away or the table is removed | The screen closes and asks you to open the table again. Nothing is taken. |
| Eliminated (Spectator) | The table can't be used. |

> **Older worlds:** Artificial Hearts crafted in versions before 0.5 still work. Hold one and use the table to redeem it. New Artificial Hearts can't be crafted.

---

## 🧱 Crafting the Reanimation Table

Craft it at a normal **Crafting Table**. The recipe unlocks in your recipe book once you have a diamond.

<table align="center">
  <tr>
    <td align="center" width="130">⬛<br><b>Obsidian</b></td>
    <td align="center" width="130">🔴<br><b>Redstone Dust</b></td>
    <td align="center" width="130">⬛<br><b>Obsidian</b></td>
  </tr>
  <tr>
    <td align="center">🟨<br><b>Gold Ingot</b></td>
    <td align="center">🪵<br><b>Crafting Table</b></td>
    <td align="center">🟨<br><b>Gold Ingot</b></td>
  </tr>
  <tr>
    <td align="center">⬛<br><b>Obsidian</b></td>
    <td align="center">💎<br><b>Diamond</b></td>
    <td align="center">⬛<br><b>Obsidian</b></td>
  </tr>
</table>

<p align="center"><b>Result:</b> 1 × Reanimation Table</p>

| Material | Amount |
| --- | :---: |
| Obsidian | 4 |
| Gold Ingot | 2 |
| Redstone Dust | 1 |
| Diamond | 1 |
| Crafting Table | 1 |

---

## 📥 Installation

You need **Minecraft: Bedrock Edition 26.60 or newer**. Full illustrated steps are in the [Player Guide](docs/PLAYER_GUIDE.md#installing-on-windows).

1. **Download** [`hearts-and-lives-v0.5.3.mcaddon`](prototypes/bedrock-hearts/dist/hearts-and-lives-v0.5.3.mcaddon?raw=true).
2. **Import:** on Windows, double-click the file. Minecraft opens and imports two packs.
3. **Create or edit a world**, then open **Behavior Packs → Available** and activate **Hearts & Lives v0.5.3 (Behaviour)**.
4. Open **Resource Packs → Available** and make sure **Hearts & Lives v0.5.3 (Resources)** is active too. Minecraft usually offers to add it for you.
5. Leave all **Experiments** switched off and press **Create** or **Play**.
6. **Check the version:** the active packs list should show **v0.5.3** in both pack names. When you join the world, chat shows your balance, for example `[Hearts & Lives] 10 lives | saved health target 10 hearts`.

> [!WARNING]
> **Updating an existing world? Make a copy first** (**Edit World → Copy World**) and test the update on the copy. Saved lives, hearts and settings carry over from 0.5.x, but a backup protects you if something goes wrong. See [Updating an existing world](docs/PLAYER_GUIDE.md#updating-an-existing-world).

**Missing blocks, items or textures?** If you see a purple-and-black block or a blank icon, the Resources pack is missing. If the table doesn't appear at all, the Behaviour pack is missing. Activate both packs in the same world. More fixes are in [Troubleshooting](docs/PLAYER_GUIDE.md#troubleshooting).

---

## 👥 Playing with friends: PC and PS5

Hearts & Lives is designed for a **Windows PC that hosts the world**, with friends joining from other devices, including **PlayStation 5**.

| | |
| --- | --- |
| **Host** | A Windows PC with the add-on installed and active in the world. |
| **Guests** | Join through **Play → Friends** (or an invite). Players on the same home network can also look for the world under **LAN Games** where available. |
| **Accounts** | Every player needs a signed-in **Microsoft account** with online multiplayer allowed. The PS5 also needs its own online play settings enabled. |
| **Packs for guests** | Guests don't install anything. The host's world sends its packs when they join. Turning on **Require players to accept resource packs to join** helps make sure everyone gets the textures. |
| **Keep the PC hosting** | Everyone's lives, hearts and settings are saved in the host's world, and the add-on runs on the host. If the host closes the world, everyone is disconnected. |
| **PS5 split-screen** | Extra players on one PS5 each sign in with their own account and get their own lives and hearts. Not yet tested with this add-on. |

> [!IMPORTANT]
> **PS5 support is not yet verified.** Windows-hosted cross-play with a PS5 guest is the intended setup, but it has not been tested with v0.5.3. Pack download, the table screen at TV distance and controller navigation are all on the [test checklist](docs/KNOWN_LIMITATIONS.md#platform-testing). Please report what you find.

Step-by-step setup: [Player Guide → Multiplayer](docs/PLAYER_GUIDE.md#multiplayer-windows-host-with-ps5-guests).

---

## ⚙️ Difficulty settings

The **world host** picks one of four presets. Today the presets change only the **restore cooldown**, which is how long a player must wait after a successful restore before restoring again.

| Preset | Restore cooldown | Restore costs |
| --- | --- | --- |
| Easy | None | Same as Normal *(provisional)* |
| **Normal** *(default)* | None | 6/2/1 full, 3/1/1 half *(approved)* |
| Hard | 10 seconds (200 ticks) | Same as Normal *(provisional)* |
| Extreme | 20 seconds (400 ticks) | Same as Normal *(provisional)* |

The cooldown values and the Easy, Hard and Extreme costs are **provisional** and may change. Lives, hearts and death rules are the same on every preset.

**Host commands.** The host types these in chat. They work with cheats **off**, and other players can't run them.

| Command | What it does |
| --- | --- |
| `/waveform:difficulty_view` | Shows the active preset, all four cooldowns and the progressive hunger setting. |
| `/waveform:difficulty_select <easy\|normal\|hard\|extreme>` | Picks the active preset. |
| `/waveform:difficulty_cooldown <preset> <ticks>` | Sets one preset's cooldown from 0 to 1200 ticks (20 ticks = 1 second). Easy can't be longer than Normal. |
| `/waveform:difficulty_hunger <on\|off>` | Turns the progressive hunger preview on or off. |

**How cooldowns behave**

- Each player has their own cooldown, which applies to both Full and Half restores.
- A cooldown starts only after a successful restore. A failed attempt costs nothing and doesn't restart it.
- An existing cooldown keeps its original end time even if the host changes presets.
- The cooldown counts game time while the world is running, so it pauses while the world is closed.

**Progressive hunger (preview, off by default).** When on, the add-on also tracks a hunger target that shrinks on death and grows on restore, and shows it in chat. **It does not change the real hunger bar yet.** Eating, sprinting and healing always follow normal Minecraft rules.

---

## ❓ FAQ and troubleshooting

<details>
<summary><b>Why did I lose a heart?</b></summary>

You died. Every death, from any cause and in any game mode, removes one life and one maximum heart. Hearts & Lives does not remove hearts for anything else.
</details>

<details>
<summary><b>Can I restore my hearts?</b></summary>

Yes, at a [Reanimation Table](#%EF%B8%8F-the-reanimation-table), up to the maximum of 10. A full heart costs 6 Diamonds, 2 Netherite Ingots and 1 Heart of the Sea.
</details>

<details>
<summary><b>Can I restore half a heart?</b></summary>

Yes. Choose **Half Heart** in the dropdown. It costs 3 Diamonds, 1 Netherite Ingot and 1 Heart of the Sea and gives back half a life and half a heart.
</details>

<details>
<summary><b>Where is the Reanimation Table?</b></summary>

Players don't start with one. [Craft it](#-crafting-the-reanimation-table) in Survival, or in Creative open the **Items** tab or search for "Reanimation Table".
</details>

<details>
<summary><b>Why can't I restore a heart?</b></summary>

Check the screen's message. You might be missing materials (red **Need** rows), have only half a heart missing (choose **Half Heart**), already have all 10 hearts, or be waiting for a cooldown. Eliminated players can't restore.
</details>

<details>
<summary><b>Why doesn't the table open?</b></summary>

- Use it while **standing**. If you're sneaking with a block in hand, you'll place the block instead.
- Make sure no other screen is open. Close it and try again.
- If you see *"The table couldn't open. Try using it again."*, use the table again. The host's Content Log records the error.
- Spectators can't use the table.
- If the block shows as an unknown block, the Behaviour pack isn't active.
</details>

<details>
<summary><b>Why aren't my ingredient counts showing correctly?</b></summary>

Counts include only your hotbar and backpack, and they refresh once per second. Each row stops at the amount the recipe needs, so 9 diamonds shows as **6/6**. Items in chests, shulker boxes, armour slots or your off-hand are not counted.
</details>

<details>
<summary><b>Can two players have different lives?</b></summary>

Yes. Every player has their own lives, hearts and cooldown, saved in the world.
</details>

<details>
<summary><b>Can I use it on PS5?</b></summary>

The intended setup is a PS5 joining a **Windows-hosted** world, using **L2** to open the table. This has **not yet been verified** on PS5 hardware with v0.5.3. Hosting the world on a PS5 hasn't been tested.
</details>

<details>
<summary><b>Does it work in Creative?</b></summary>

The table and its recipe work in any game mode except Spectator, and deaths count in any game mode. The add-on is designed for Survival. Creative is handy for trying out the table.
</details>

<details>
<summary><b>Does it require experiments?</b></summary>

No. Hearts & Lives uses only stable Bedrock features. Keep all experiments off. Note that Bedrock normally turns off achievements in worlds that use add-ons.
</details>

<details>
<summary><b>Can I use this with other Bedrock add-ons?</b></summary>

Often, but no combinations have been tested. Hearts & Lives replaces the player's health setup to make permanent heart limits work, so **other add-ons that change the player's maximum health or the player entity are likely to conflict**. Try combinations on a copy of your world first. See [Known Limitations](docs/KNOWN_LIMITATIONS.md#compatibility-with-other-add-ons).
</details>

<details>
<summary><b>What is the Hearts Probe item in Creative?</b></summary>

It's a test tool. Using it shows your current and maximum health in the action bar. You don't need it to play.
</details>

More answers: [Player Guide → Troubleshooting](docs/PLAYER_GUIDE.md#troubleshooting).

---

## 🗺️ Current release and roadmap

**v0.5.3 (current)**

- ✅ Lives and permanent native heart loss on death
- ✅ Spectator elimination at zero lives
- ✅ Craftable, movable Reanimation Table with Full and Half Heart restores
- ✅ Per-player progress in multiplayer
- ✅ Host difficulty presets with restore cooldowns
- ✅ Clearer table screen with **Ready** and **Need** labels (new in 0.5.3)

**Still being tested**

- 🔍 v0.5.3 table layout on Windows at different GUI scales
- 🔍 PS5 guests on a Windows-hosted world, including controller navigation

**Planned, not in this release**

- 📝 Approved costs for Easy, Hard and Extreme
- 📝 Progressive hunger that changes the real hunger bar

---

## 📚 Documentation

| Document | For |
| --- | --- |
| [Player Guide](docs/PLAYER_GUIDE.md) | Detailed install, update, multiplayer and troubleshooting steps |
| [Known Limitations](docs/KNOWN_LIMITATIONS.md) | What's unverified, provisional or unsupported |
| [Development](docs/DEVELOPMENT.md) | Building, testing, packaging and releasing |
| [Release handover](prototypes/bedrock-hearts/HANDOVER.md) | Detailed v0.5.3 engineering notes |
| [Retail test procedures](prototypes/bedrock-hearts/README.md) | Windows and PS5 acceptance checks |
| [Native Health Probe](prototypes/bedrock-native-caps/HANDOVER.md) | Separate diagnostic packs |

---

<sub>Hearts & Lives is a fan-made add-on by Waveform Labs. NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT. The packaged add-on includes Mojang's vanilla player definition and item textures, which are subject to the [Minecraft End User License Agreement](https://www.minecraft.net/en-us/eula).</sub>
