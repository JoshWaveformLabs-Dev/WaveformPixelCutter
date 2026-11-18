import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { setImmediate } from "node:timers/promises"
import { beforeEach, test } from "node:test"
import { GameMode, Player, Stack, saved, system, world } from "./support/mock-bedrock.js"

const urls = new Map([
    ["@minecraft/server", new URL("./support/mock-bedrock.js", import.meta.url).href],
    ["@minecraft/server-ui", new URL("./support/mock-ui.js", import.meta.url).href],
])
const hook = registerHooks({ resolve(specifier, context, next) {
    return urls.has(specifier) ? { shortCircuit: true, url: urls.get(specifier) } : next(specifier, context)
} })
await import("../.build/scripts/main.js")
const { readDifficultySettings, DIFFICULTY_SETTINGS_KEY } = await import("../.build/scripts/difficulty-bedrock.js")
hook.deregister()
beforeEach(() => { saved.clear(); world.afterEvents.worldLoad.emit() })

const readState = p => JSON.parse(saved.get("waveform:hearts_lives." + p.id))
const settle = () => setImmediate()
const labels = form => form.labels.map(x => x.getData()).join("\n")
function fixture(id, units = 15) {
    const player = new Player(id)
    saved.set("waveform:hearts_lives." + id, JSON.stringify({ version: 1, units }))
    world.afterEvents.playerSpawn.emit({ player, initialSpawn: true })
    player.health = 4
    const block = {
        typeId: "waveform:reanimation_table", location: { x: 3, y: 70, z: 5 },
        dimension: { id: player.dimension.id, getBlock: () => block },
    }
    const items = [[1, "diamond", 2], [35, "diamond", 5], [11, "netherite_ingot", 2],
        [12, "heart_of_the_sea", 1], [17, "dirt", 64]]
    for (const [slot, type, amount] of items) player.inventory.setItem(slot, new Stack("minecraft:" + type, amount))
    const use = (isFirstEvent = true) => {
        const event = { player, block, isFirstEvent, itemStack: player.inventory.getItem(0), cancel: false }
        world.beforeEvents.playerInteractWithBlock.emit(event)
        return event
    }
    const open = () => { assert.equal(use().cancel, true); system.advance(); return player.forms.at(-1) }
    const amounts = () => items.map(([slot]) => player.inventory.getItem(slot)?.amount ?? 0)
    return { player, block, use, open, amounts }
}

test("empty-hand checklist distinguishes partial affordability, capacity and all four preset prices", async () => {
    for (const preset of ["normal", "easy", "hard", "extreme"]) {
        const settings = readDifficultySettings()
        saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify({ ...settings, activePreset: preset }))
        const { player, open, amounts } = fixture(preset)
        player.inventory.setItem(35, new Stack("minecraft:diamond", 2))
        const form = open()
        assert.equal(form.title, "REANIMATION TABLE")
        assert.equal(form.images.length, 3)
        const text = labels(form)
        assert.match(text, /Lives remaining  7.5/)
        assert.match(text, /Current maximum  7.5 hearts/)
        assert.match(text, /Recoverable limit  10 base hearts/)
        assert.match(text, new RegExp("Difficulty  " + preset, "i"))
        assert.match(text, /4 \/ 6 · Need 2/)
        assert.match(text, /4 \/ 3 · Have/)
        assert.match(text, /2 \/ 2 · Have/)
        assert.match(text, /1 \/ 1 · Have/)
        assert.deepEqual(form.buttons.map(b => b.disabled.getData()), [true, false])
        form.buttons[0].click()
        assert.equal(form.isShowing(), true)
        form.buttons[1].click()
        await settle()
        assert.deepEqual(amounts(), [0, 1, 1, 0, 64])
        assert.deepEqual([readState(player).lives, player.healthMax, player.health], [16, 16, 4])
    }
})

test("two concurrent users choose independently and held input and duplicate clicks charge once", async () => {
    const a = fixture("host"), b = fixture("guest")
    a.use(); a.use(); b.use()
    system.advance()
    a.use(false); a.use(); b.use()
    system.advance()
    assert.equal(a.player.forms.length, 1)
    assert.equal(b.player.forms.length, 1)
    a.player.forms[0].buttons[0].click()
    a.player.forms[0].buttons[1].click()
    b.player.forms[0].buttons[1].click()
    await settle()
    assert.deepEqual(a.amounts(), [0, 1, 0, 0, 64])
    assert.deepEqual(b.amounts(), [0, 4, 1, 0, 64])
    assert.deepEqual([readState(a.player).lives, a.player.healthMax], [17, 17])
    assert.deepEqual([readState(b.player).lives, b.player.healthMax], [16, 16])
})

test("closing the form or a busy client leaves payment intact and permits reopening", async () => {
    const f = fixture("cancel")
    for (const reason of ["ClientClosed", "UserBusy"]) {
        f.open().dismiss(reason)
        await settle()
        assert.deepEqual(f.amounts(), [2, 5, 2, 1, 64])
        assert.equal(readState(f.player).lives, 15)
    }
    assert.match(f.player.messages.at(-1), /Close the other screen/)
})

test("commit rechecks the displayed price, player, table, stock and remaining capacity", async () => {
    for (const [id, change] of [
        ["missing", f => f.player.inventory.setItem(12, undefined)],
        ["removed", f => { f.block.typeId = "minecraft:air" }],
        ["distant", f => { f.player.location.x += 20 }],
        ["dimension", f => { f.player.dimension = { id: "minecraft:nether" } }],
        ["spectator", f => { f.player.mode = GameMode.Spectator }],
        ["dead", f => { f.player.health = 0; world.afterEvents.entityDie.emit({ deadEntity: f.player }) }],
        ["leave", f => world.afterEvents.playerLeave.emit({ playerId: f.player.id })],
        ["respawn", f => world.afterEvents.playerSpawn.emit({ player: f.player, initialSpawn: false })],
        ["cap", f => saved.set("waveform:hearts_lives." + f.player.id, '{"version":1,"units":20}')],
        ["settings", () => {
            const settings = readDifficultySettings()
            saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify({ ...settings, activePreset: "hard" }))
        }],
    ]) {
        const f = fixture(id)
        const form = f.open()
        change(f)
        const before = readState(f.player)
        const stock = f.amounts()
        form.buttons[0].click()
        await settle()
        assert.deepEqual(f.amounts(), stock, id)
        assert.deepEqual(readState(f.player), before, id)
        if (id === "missing") assert.match(f.player.messages.at(-1), /Missing materials/)
    }
})

test("a half-heart deficit disables full restoration, and reaching ten disables both", async () => {
    const f = fixture("cap", 19)
    const form = f.open()
    assert.deepEqual(form.buttons.map(b => b.disabled.getData()), [true, false])
    form.buttons[1].click()
    await settle()
    assert.equal(f.player.healthMax, 20)
    f.player.inventory.setItem(12, new Stack("minecraft:heart_of_the_sea", 1))
    const next = f.open()
    assert.deepEqual(next.buttons.map(b => b.disabled.getData()), [true, true])
    assert.match(labels(next), /Materials ready · Capacity limit/)
    next.dismiss()
    await settle()
})

test("cooldown countdown and changing inventory update while the table stays open", async () => {
    const settings = readDifficultySettings()
    settings.presets.normal.recoveryCooldownTicks = 40
    saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify(settings))
    const f = fixture("cooldown")
    f.open().buttons[1].click()
    await settle()
    const form = f.open()
    assert.match(labels(form), /2s remaining/)
    assert.deepEqual(form.buttons.map(b => b.disabled.getData()), [true, true])
    f.player.inventory.setItem(20, new Stack("minecraft:heart_of_the_sea", 2))
    for (let i = 0; i < 60; i++) system.advance()
    assert.match(labels(form), /Cooldown  Ready/)
    assert.deepEqual(form.buttons.map(b => b.disabled.getData()), [true, false])
    form.buttons[1].click()
    await settle()
    assert.equal(f.player.healthMax, 17)
    assert.equal(f.player.inventory.getItem(20).amount, 1)
})

test("split-stack transaction compensates partial writes and verifies state before refunding", async t => {
    for (const fault of ["noop-slot", "throw-after-slot", "save-failed", "save-then-throw"]) {
        const f = fixture(fault)
        const form = f.open()
        const inv = f.player.inventory
        const previous = f.amounts()
        const write = inv.setItem.bind(inv)
        const save = world.setDynamicProperty.bind(world)
        const slotFault = t.mock.method(inv, "setItem", (slot, stack) => {
            if (slot === 12 && !stack && fault === "noop-slot") return
            write(slot, stack)
            if (slot === 12 && !stack && fault === "throw-after-slot") throw Error("after debit")
        })
        const saveFault = t.mock.method(world, "setDynamicProperty", (key, value) => {
            if (fault === "save-failed") throw Error("storage unavailable")
            save(key, value)
            if (fault === "save-then-throw") throw Error("after save")
        })
        form.buttons[0].click()
        await settle()
        saveFault.mock.restore()
        slotFault.mock.restore()
        if (fault === "save-then-throw") {
            assert.deepEqual([readState(f.player).lives, f.player.healthMax], [17, 17])
            assert.deepEqual(f.amounts(), [0, 1, 0, 0, 64])
        } else {
            assert.deepEqual([readState(f.player).lives, f.player.healthMax], [15, 15])
            assert.deepEqual(f.amounts(), previous)
        }
    }
})
