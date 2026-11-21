# Hearts & Lives Player Guide

This guide covers installing **Hearts & Lives v0.5.3**, updating a world, multiplayer setup and troubleshooting. For the rules, the Reanimation Table and the crafting recipe, start with the [main README](../README.md).

> Hearts & Lives is an add-on for **Minecraft: Bedrock Edition 26.60 or newer**. It does not work with Java Edition.

## Contents

- [What you download](#what-you-download)
- [Installing on Windows](#installing-on-windows)
- [Creating a new world](#creating-a-new-world)
- [Updating an existing world](#updating-an-existing-world)
- [Checking your installed version](#checking-your-installed-version)
- [Your first session](#your-first-session)
- [Multiplayer: Windows host with PS5 guests](#multiplayer-windows-host-with-ps5-guests)
- [Host commands](#host-commands)
- [Troubleshooting](#troubleshooting)

## What you download

[`hearts-and-lives-v0.5.3.mcaddon`](../prototypes/bedrock-hearts/dist/hearts-and-lives-v0.5.3.mcaddon?raw=true) is a single file that contains two packs. You need **both** packs active in the same world.

| Pack name in Minecraft | What it adds |
| --- | --- |
| **Hearts & Lives v0.5.3 (Behaviour)** | Lives, heart loss, elimination, the Reanimation Table block and recipe, and host commands |
| **Hearts & Lives v0.5.3 (Resources)** | Reanimation Table textures, item icons and the ingredient pictures on the table screen |

Older files in the same folder (`v0.5.0` to `v0.5.2`, `dev` and `hearts-probe`) are kept for testing history. Use v0.5.3.

## Installing on Windows

1. Download [`hearts-and-lives-v0.5.3.mcaddon`](../prototypes/bedrock-hearts/dist/hearts-and-lives-v0.5.3.mcaddon?raw=true). On the GitHub file page, use the download button.
2. Close Minecraft if it's running.
3. Double-click the downloaded file. Minecraft starts and shows an import message for each pack.
4. If Windows asks which app to open the file with, choose **Minecraft**.

If you have this repository on your PC, you can also import from PowerShell:

```powershell
Invoke-Item -LiteralPath 'C:\Projects\minecraft heart\prototypes\bedrock-hearts\dist\hearts-and-lives-v0.5.3.mcaddon'
```

## Creating a new world

1. Choose **Play → Create New → Create New World**.
2. Under **Behavior Packs → Available**, select **Hearts & Lives v0.5.3 (Behaviour)** and press **Activate**.
3. If Minecraft asks to activate the Resources pack it depends on, accept. Otherwise open **Resource Packs → Available** and activate **Hearts & Lives v0.5.3 (Resources)**.
4. Under **Experiments**, leave every toggle **off**. Hearts & Lives doesn't need any.
5. Pick **Survival**, adjust the other settings and press **Create**.

Cheats can stay off. Bedrock normally disables achievements for worlds with add-ons.

## Updating an existing world

Saved lives, hearts, cooldowns and difficulty settings carry over from v0.5.0, v0.5.1 and v0.5.2. Both packs keep the same identity, so the new version replaces the old one in the same slot.

1. **Back up first.** In the world list, select the world's edit (pencil) button and choose **Copy World**. Test the update on the copy.
2. Import v0.5.3 as described above.
3. Open the copied world's settings. Under **Behavior Packs → Active**, check the pack name. If it still shows an older version, deactivate it, then activate **Hearts & Lives v0.5.3 (Behaviour)**.
4. Do the same under **Resource Packs → Active** for **Hearts & Lives v0.5.3 (Resources)**.
5. Keep experiments off, start the world and [check the version](#checking-your-installed-version).
6. Once you're happy, update your main world the same way.

Previously crafted Artificial Hearts from 0.4 worlds still work. Hold one and use the table to redeem it.

## Checking your installed version

- **Pack names:** in the world's active pack lists, both names include **v0.5.3**.
- **Join message:** when you join or respawn, chat shows your balance, for example:

  ```text
  [Hearts & Lives] 10 lives | saved health target 10 hearts
  ```

- **Table screen:** v0.5.3 shows the item rows with **Ready** or **Need** words, for example **Diamond 4/6 - Need 2**. v0.5.2 used symbols instead.

## Your first session

1. Join your world. Check the chat message showing 10 lives.
2. Mine diamonds, then gather 4 Obsidian, 2 Gold Ingots, 1 Redstone Dust and a Crafting Table. [Craft the Reanimation Table](../README.md#-crafting-the-reanimation-table).
3. Place the table somewhere safe, such as your base.
4. Start saving diamonds, netherite ingots and Hearts of the Sea from buried treasure. You'll need them after your first death.
5. After a death, open the table (right-click on Windows, **L2** on PS5), choose **Full Heart** or **Half Heart** and press **RESTORE HEART** when it lights up.

The table is mined like a normal block and drops itself, so you can move it.

## Multiplayer: Windows host with PS5 guests

Hearts & Lives runs on the **host's** world. The intended setup is a Windows PC hosting, with friends joining from Windows or PlayStation 5.

> **Not yet verified on PS5.** The steps below are the intended setup. A PS5 guest joining a v0.5.3 world has not been tested yet. See [Known Limitations](KNOWN_LIMITATIONS.md#platform-testing).

### Before you start

- Every player signs in with a **Microsoft account**. On PS5, sign in from Minecraft's main menu.
- Online multiplayer must be allowed for each account. This includes Microsoft account privacy settings and, on PS5, the console's online and family settings.
- Host and guests should run the same or a compatible Minecraft version (26.60 or newer).

### Host (Windows)

1. Install the add-on and create or update the world as above.
2. In the world's **Multiplayer** settings, enable **Multiplayer Game** and choose who can join (for example **Friends of Friends** or **Friends Only**).
3. To help guests get the textures, enable **Require players to accept resource packs to join** in the world settings.
4. To let players on your home network find the world, enable **Visible to LAN Players**.
5. Start the world and leave it running for the whole session.

### Guests (PS5 or Windows)

1. Add the host as a friend through their Microsoft account (gamertag).
2. Open **Play → Friends**. The host's world appears under **Joinable Friends** or **Joinable Cross-Platform Friends**. You can also accept an invite from the host.
3. On the same network, the world may also appear under **LAN Games**.
4. When asked, accept the resource pack download. Guests don't install the `.mcaddon` themselves.
5. Once in, chat shows your own `[Hearts & Lives]` balance.

### PS5 split-screen

Minecraft on PS5 supports split-screen by connecting another controller and signing in a second account. Each split-screen player is a separate player with their own lives and hearts. Split-screen has **not been tested** with Hearts & Lives.

### Why the PC must keep hosting

- Every player's lives, hearts and cooldown, and the difficulty settings, are saved **in the host's world**.
- The add-on's scripts run on the host. Guests rely on the host for deaths, restores and table screens.
- If the host leaves, everyone is disconnected. Progress is kept and continues when the host reopens the world.

## Host commands

The world host runs these in chat. They work with cheats off. Other players can't change the settings. Full details are in the [README difficulty section](../README.md#%EF%B8%8F-difficulty-settings).

| Command | Effect |
| --- | --- |
| `/waveform:difficulty_view` | Show the active preset, cooldowns and progressive hunger setting |
| `/waveform:difficulty_select <preset>` | Choose `easy`, `normal`, `hard` or `extreme` |
| `/waveform:difficulty_cooldown <preset> <ticks>` | Set that preset's restore cooldown (0 to 1200 ticks, 20 ticks = 1 second) |
| `/waveform:difficulty_hunger <on\|off>` | Turn the progressive hunger preview on or off |

The host also has testing commands such as `/waveform:reset_lives`. These need cheats on and are meant for test worlds. See [Development](DEVELOPMENT.md#test-world-helpers).

## Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| The Reanimation Table isn't in Creative or the recipe book | Behaviour pack not active | Activate **Hearts & Lives v0.5.3 (Behaviour)** in the world. |
| The table is purple and black, or icons are blank | Resources pack not active, or a guest declined the download | Activate **Hearts & Lives v0.5.3 (Resources)**. Guests should rejoin and accept the packs. |
| No `[Hearts & Lives]` message on join | Behaviour pack not active, or an old version is active | Check the active packs and their version. |
| Pack names show an older version | The world still uses the old pack | Deactivate it and activate v0.5.3. See [Updating](#updating-an-existing-world). |
| The table doesn't open | Sneaking with a block, another screen open, Spectator mode, or too far away | Stand within a few blocks and use it without sneaking. Close other screens. |
| *"The table couldn't open. Try using it again."* | A one-off screen error | Use the table again. If it keeps happening, the host should check the Content Log. |
| *"Open the Reanimation Table again."* | You moved away, the table was removed or the host changed settings | Reopen the table. Nothing was spent. |
| **RESTORE HEART** is greyed out | Missing materials, a cooldown, or a full heart won't fit | Read the red **Need** rows or the message under the dropdown. |
| *"Only half a heart will fit."* | You're at 9½ hearts | Choose **Half Heart**. |
| Ingredient counts look wrong | Items are outside the hotbar and backpack | Move the items into your main inventory. Counts refresh every second. |
| Heart bar didn't change after a restore | The game can take a moment to update the maximum | Wait a few seconds or rejoin. Your restore is already saved. |
| *"Recovery error. Check the host log before retrying."* | A rare save problem | Don't retry straight away. The host should check the Content Log and the player's inventory first. |
| Stuck in Spectator | You ran out of lives (eliminated) | Elimination is permanent in normal play. |

**For hosts:** enable **Settings → Creator → Content Log File** in Minecraft to record `[Hearts & Lives]` messages. They help diagnose table, save and health problems.
