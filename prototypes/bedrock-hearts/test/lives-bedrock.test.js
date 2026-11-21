import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"
import * as mockBedrock from "./support/mock-bedrock.js"

const { Player, Stack, world, saved, system, GameMode, CustomCommandSource, CustomCommandStatus } = mockBedrock
const mockServerUrl = new URL("./support/mock-bedrock.js", import.meta.url).href
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@minecraft/server") return { shortCircuit: true, url: mockServerUrl }
        if (specifier === "@minecraft/server-ui") return { shortCircuit: true, url: new URL("./support/mock-ui.js", import.meta.url).href }
        return nextResolve(specifier, context)
    },
})
await import("../.build/scripts/main.js")
const { DIFFICULTY_SETTINGS_KEY, PROGRESSIVE_HUNGER_KEY } = await import("../.build/scripts/difficulty-bedrock.js")
hooks.deregister()

const { decodeDifficultySettings, editRecoveryCooldown, encodeDifficultySettings, selectDifficultyPreset } =
    await import("../.build/scripts/difficulty-settings.js")

const components = new Map()
const commands = new Map()
system.beforeEvents.startup.emit({
    itemComponentRegistry: { registerCustomComponent: (id, callbacks) => components.set(id, callbacks) },
    customCommandRegistry: {
        registerCommand: (definition, execute) => commands.set(definition.name, { definition, execute }),
        registerEnum() {},
    },
})

const FULL = "waveform:artificial_heart"
const HALF = "waveform:half_artificial_heart"
const state = (id) => JSON.parse(saved.get(`waveform:hearts_lives.${id}`))
const rosterSpawn = (player) => world.afterEvents.playerSpawn.emit({ player, initialSpawn: true })
const die = (player) => world.afterEvents.entityDie.emit({ deadEntity: player })
const TABLE = "waveform:reanimation_table"
const tableAt = (typeId = TABLE) => {
    const location = { x: 3, y: 70, z: 5 }
    const block = { typeId, location, dimension: {
        id: "minecraft:overworld",
        getBlock: (position) => JSON.stringify(position) === JSON.stringify(location) ? block : undefined,
    } }
    return block
}
function interact(player, options = {}) {
    const event = { player, block: tableAt(), itemStack: player.inventory.getItem(player.selectedSlotIndex),
        isFirstEvent: true, cancel: false, ...options }
    world.beforeEvents.playerInteractWithBlock.emit(event)
    return event
}
function injured(id, units = 14) {
    const player = new Player(id)
    saved.set(`waveform:hearts_lives.${id}`, JSON.stringify({ version: 1, units }))
    rosterSpawn(player)
    player.inventory.setItem(0, new Stack(FULL, 3))
    return player
}

test("mocked callbacks isolate deaths, deduplicate, and reconcile eliminated reconnects", () => {
    const a = new Player("death-a")
    const b = new Player("death-b")
    rosterSpawn(a)
    rosterSpawn(b)
    for (let index = 1; index <= 10; index++) {
        system.advance()
        a.health = 0
        die(a)
        die(a)
        // A duplicate in a later tick while the player is still dead.
        system.advance()
        die(a)
        a.health = 20
        rosterSpawn(a)
        // A stale callback when the entity handle already refers to the living player.
        system.advance()
        die(a)
        assert.equal(state(a.id).lives, 20 - index * 2)
    }
    die({ typeId: "minecraft:zombie" })
    assert.equal(state(b.id).lives, 20)
    assert.equal(b.mode, GameMode.Survival)
    assert.equal(a.mode, GameMode.Spectator)

    const rejoined = new Player(a.id)
    world.players = [rejoined]
    world.afterEvents.worldLoad.emit()
    rosterSpawn(rejoined)
    assert.equal(rejoined.mode, GameMode.Spectator)
    assert.equal(state(a.id).lives, 0)
    const heart = new Stack(FULL, 2)
    rejoined.inventory.setItem(0, heart)
    interact(rejoined)
    system.advance()
    assert.equal(rejoined.inventory.getItem(0).amount, 2)
})

test("Spectator enforcement precedes a failing reconciliation write", (t) => {
    const player = new Player("write-fault")
    saved.set(`waveform:hearts_lives.${player.id}`,
        '{"version":2,"lives":0,"hearts":0,"hunger":0,"awaitingRespawn":true}')
    t.mock.method(world, "setDynamicProperty", () => { throw new Error("injected write failure") })
    rosterSpawn(player)
    assert.equal(player.mode, GameMode.Spectator)
    system.advance()
    assert.equal(state(player.id).lives, 0)
})

test("table defers full and half recovery and debits only the initiating player's selected stack", () => {
    const a = injured("table-a")
    const b = injured("table-b")
    b.selectedSlotIndex = 4
    b.inventory.setItem(4, new Stack(HALF, 1))
    const table = tableAt()
    assert.equal(interact(a, { block: table }).cancel, true)
    assert.equal(interact(b, { block: table }).cancel, true)
    assert.equal(state(a.id).lives, 14)
    assert.equal(a.inventory.getItem(0).amount, 3)
    assert.equal(b.inventory.getItem(4).amount, 1)

    system.advance()
    assert.deepEqual([state(a.id).lives, state(a.id).hearts, state(a.id).hunger], [16, 16, 16])
    assert.equal(a.inventory.getItem(0).amount, 2)
    assert.deepEqual([state(b.id).lives, state(b.id).hearts, state(b.id).hunger], [15, 15, 15])
    assert.equal(b.inventory.getItem(0).amount, 3)
    assert.equal(b.inventory.getItem(4), undefined)
    assert.equal(components.has("waveform:recover_capacity"), false)
})

test("ordinary blocks, sneak-use with ordinary items and already canceled actions cannot restore capacity", () => {
    const player = injured("table-only")
    player.isSneaking = true
    for (const options of [
        { block: tableAt("minecraft:crafting_table") },
        { itemStack: new Stack("minecraft:stone", 1) },
        { itemStack: new Stack(TABLE, 1) },
        { itemStack: new Stack("waveform:hearts_probe", 1) },
    ]) {
        assert.equal(interact(player, options).cancel, false)
    }
    assert.equal(interact(player, { cancel: true }).cancel, true)
    system.advance()
    assert.equal(state(player.id).lives, 14)
    assert.equal(player.inventory.getItem(0).amount, 3)
})

test("duplicate same-tick events and held-button repeats never grant additional recovery", (t) => {
    const player = injured("table-duplicate")
    const run = t.mock.method(system, "run")
    interact(player)
    interact(player)
    assert.equal(run.mock.callCount(), 1)
    system.flush()
    assert.equal(state(player.id).lives, 16)

    // The deferred callback can run in the same tick. A new event can already see the debited stack.
    interact(player)
    assert.equal(run.mock.callCount(), 1)
    system.advance()
    assert.equal(interact(player, { isFirstEvent: false }).cancel, true)
    system.advance()
    interact(player, { isFirstEvent: false })
    system.advance()
    assert.equal(state(player.id).lives, 16)
    assert.equal(player.inventory.getItem(0).amount, 2)

    interact(player)
    system.advance()
    assert.equal(state(player.id).lives, 18)
    assert.equal(player.inventory.getItem(0).amount, 1)
})

test("table rejects full hearts for a half-unit deficit and rejects recovery at cap", () => {
    const player = injured("table-over-cap", 19)
    interact(player)
    system.advance()
    assert.equal(state(player.id).lives, 19)
    assert.equal(player.inventory.getItem(0).amount, 3)
    assert.equal(player.messages.at(-1), "Only half a heart will fit.")

    player.inventory.setItem(0, new Stack(HALF, 2))
    interact(player)
    system.advance()
    assert.equal(state(player.id).lives, 20)
    interact(player)
    system.advance()
    assert.equal(state(player.id).lives, 20)
    assert.equal(player.inventory.getItem(0).amount, 1)
    assert.equal(player.messages.at(-1), "ALL HEARTS RESTORED!")
})

test("table does not debit or restore when the held slot or exact stack changes before execution", () => {
    for (const [label, change] of [
        ["slot", (player) => { player.selectedSlotIndex = 1 }],
        ["drop", (player) => player.inventory.setItem(0, undefined)],
        ["count", (player) => player.inventory.setItem(0, new Stack(FULL, 2))],
        ["metadata", (player) => player.inventory.setItem(0, new Stack(FULL, 3, "renamed"))],
        ["type", (player) => player.inventory.setItem(0, new Stack(HALF, 3))],
    ]) {
        const player = injured(`table-stale-${label}`)
        interact(player)
        change(player)
        const stack = player.inventory.getItem(0)
        system.advance()
        assert.equal(state(player.id).lives, 14, label)
        assert.deepEqual(player.inventory.getItem(0), stack, label)
    }
})

test("table requests expire after station removal, dimension change, death, leaving or respawning", () => {
    for (const [label, invalidate] of [
        ["broken", (_player, block) => { block.typeId = "minecraft:air" }],
        ["dimension", (player) => { player.dimension = { id: "minecraft:nether" } }],
        ["dead", (player) => { player.health = 0 }],
        ["invalid", (player) => { player.isValid = false }],
        ["spectator", (player) => { player.mode = GameMode.Spectator }],
        ["leave", (player) => world.afterEvents.playerLeave.emit({ playerId: player.id })],
        ["respawn", (player) => world.afterEvents.playerSpawn.emit({ player, initialSpawn: false })],
    ]) {
        const player = injured(`table-expired-${label}`)
        const block = tableAt()
        interact(player, { block })
        invalidate(player, block)
        system.advance()
        assert.equal(state(player.id).lives, 14, label)
        assert.equal(player.inventory.getItem(0).amount, 3, label)
    }
})

test("table recovery keeps the existing inventory rollback and failure message when saving fails", (t) => {
    const player = injured("table-save-failure")
    t.mock.method(world, "setDynamicProperty", () => { throw new Error("injected recovery write failure") })
    interact(player)
    system.advance()
    assert.equal(state(player.id).lives, 14)
    assert.equal(player.inventory.getItem(0).amount, 3)
    assert.match(player.messages.at(-1), /Recovery error/)
})

test("host reset is permission-gated, targeted, deferred, and restores Survival", () => {
    const { definition, execute } = commands.get("waveform:reset_lives")
    assert.equal(definition.permissionLevel, mockBedrock.CommandPermissionLevel.Host)
    assert.equal(definition.cheatsRequired, true)
    const host = new Player("host")
    rosterSpawn(host)
    const target = new Player("reset-target")
    saved.set(`waveform:hearts_lives.${target.id}`, '{"version":1,"units":0}')
    rosterSpawn(target)
    const origin = { sourceType: CustomCommandSource.Entity, sourceEntity: host }
    assert.equal(execute(origin, [host, target]).status, CustomCommandStatus.Failure)
    assert.equal(execute({ ...origin, sourceType: CustomCommandSource.Block }, [target]).status,
        CustomCommandStatus.Failure)
    assert.equal(execute(origin, [target]).status, CustomCommandStatus.Success)
    assert.equal(target.mode, GameMode.Spectator)
    system.advance()
    assert.equal(target.mode, GameMode.Survival)
    assert.equal(state(target.id).lives, 20)
    assert.equal(state(host.id).lives, 20)
})

test("Hearts Probe is registered separately and reads native attributes without changing life state", () => {
    const player = new Player("probe")
    rosterSpawn(player)
    player.health = 17
    const probe = components.get("waveform:report_attributes")
    probe.onUse({ source: player, itemStack: new Stack("waveform:hearts_probe", 1) })
    assert.match(player.actionBar.at(-1), /HP 17\/20/)
    assert.equal(state(player.id).lives, 20)
    assert.ok(commands.has("waveform:set_current"))
})

test("a failed reset write never releases an eliminated player", (t) => {
    const host = new Player("failed-reset-host")
    const target = new Player("failed-reset-target")
    saved.set(`waveform:hearts_lives.${target.id}`, '{"version":1,"units":0}')
    rosterSpawn(target)
    t.mock.method(world, "setDynamicProperty", () => { throw new Error("injected reset write failure") })
    const origin = { sourceType: CustomCommandSource.Entity, sourceEntity: host }
    commands.get("waveform:reset_lives").execute(origin, [target])
    system.advance()
    assert.equal(target.mode, GameMode.Spectator)
    assert.equal(state(target.id).lives, 0)
    assert.match(host.messages.at(-1), /reset failed/i)
})

function configureCooldown(t, preset, ticks) {
    const settings = selectDifficultyPreset(decodeDifficultySettings(undefined), preset)
    saved.set(DIFFICULTY_SETTINGS_KEY, encodeDifficultySettings(editRecoveryCooldown(settings, preset, ticks)))
    t.after(() => saved.delete(DIFFICULTY_SETTINGS_KEY))
}

test("both hearts share one player cooldown, with denial at N−1 and success at N", (t) => {
    configureCooldown(t, "hard", 3)
    const a = injured("cooldown-a")
    const b = injured("cooldown-b")

    interact(a)
    system.advance()
    const firstExpiry = state(a.id).recoveryReadyAt
    assert.equal(state(a.id).lives, 16)
    assert.ok(Number.isSafeInteger(firstExpiry))

    a.inventory.setItem(0, new Stack(HALF, 2))
    interact(b)
    system.advance()
    assert.equal(state(b.id).lives, 16, "another player can recover during A's cooldown")
    assert.equal(state(b.id).recoveryReadyAt, firstExpiry + 1)

    interact(a)
    system.advance()
    assert.equal(a.messages.at(-1), "Try again in 1 second.")
    assert.equal(state(a.id).lives, 16)
    assert.equal(state(a.id).recoveryReadyAt, firstExpiry)
    assert.equal(a.inventory.getItem(0).amount, 2)

    interact(a)
    system.advance()
    assert.equal(state(a.id).lives, 17)
    assert.equal(state(a.id).recoveryReadyAt, firstExpiry + 3)
    assert.equal(a.inventory.getItem(0).amount, 1)
    assert.equal(state(b.id).lives, 16)
})

test("an issued cooldown survives edits, a preset switch and a reopened world", (t) => {
    configureCooldown(t, "hard", 4)
    const a = injured("cooldown-reload")
    interact(a)
    system.advance()
    const firstExpiry = state(a.id).recoveryReadyAt
    const original = decodeDifficultySettings(saved.get(DIFFICULTY_SETTINGS_KEY))
    const edited = selectDifficultyPreset(editRecoveryCooldown(original, "hard", 1), "normal")
    saved.set(DIFFICULTY_SETTINGS_KEY, encodeDifficultySettings(edited))
    system.advance()
    world.afterEvents.playerLeave.emit({ playerId: a.id })

    const returning = new Player(a.id)
    returning.inventory.setItem(0, a.inventory.getItem(0))
    world.players = [returning]
    t.after(() => { world.players = [] })
    // A new script session starts at its own tick. The saved checkpoint supplies its origin.
    system.currentTick = 0
    world.afterEvents.worldLoad.emit()
    rosterSpawn(returning)
    assert.equal(state(a.id).recoveryReadyAt, firstExpiry)

    interact(returning)
    system.advance()
    assert.equal(returning.messages.at(-1), "Try again in 1 second.")
    assert.equal(returning.inventory.getItem(0).amount, 2)
    system.advance()
    interact(returning)
    system.advance()
    assert.equal(state(a.id).lives, 18)
    assert.equal(state(a.id).recoveryReadyAt, undefined)

    interact(returning)
    system.advance()
    assert.equal(state(a.id).lives, 20, "new Normal uses have zero delay")
    assert.equal(returning.inventory.getItem(0), undefined)
})

test("an over-cap attempt and a failed save issue no player cooldown", (t) => {
    configureCooldown(t, "extreme", 1200)
    const overCap = injured("cooldown-overcap", 19)
    interact(overCap)
    system.advance()
    assert.equal(state(overCap.id).recoveryReadyAt, undefined)
    assert.equal(overCap.inventory.getItem(0).amount, 3)
    overCap.inventory.setItem(0, new Stack(HALF, 1))
    interact(overCap)
    system.advance()
    assert.equal(state(overCap.id).lives, 20)

    const failure = injured("cooldown-write-failure")
    const write = world.setDynamicProperty.bind(world)
    const fault = t.mock.method(world, "setDynamicProperty", (key, value) => {
        if (key === `waveform:hearts_lives.${failure.id}`) throw new Error("injected recovery write failure")
        write(key, value)
    })
    interact(failure)
    system.advance()
    assert.equal(state(failure.id).recoveryReadyAt, undefined)
    assert.equal(state(failure.id).lives, 14)
    assert.equal(failure.inventory.getItem(0).amount, 3)
    fault.mock.restore()
    interact(failure)
    system.advance()
    assert.equal(state(failure.id).lives, 16)
    assert.ok(state(failure.id).recoveryReadyAt >= 1200)
})

test("an unsupported settings record is preserved and prevents any debit", (t) => {
    const future = '{"version":2,"futureSetting":true}'
    saved.set(DIFFICULTY_SETTINGS_KEY, future)
    t.after(() => saved.delete(DIFFICULTY_SETTINGS_KEY))
    const player = injured("cooldown-invalid-settings")
    interact(player)
    system.advance()
    assert.equal(saved.get(DIFFICULTY_SETTINGS_KEY), future)
    assert.equal(state(player.id).lives, 14)
    assert.equal(player.inventory.getItem(0).amount, 3)
    assert.match(player.messages.at(-1), /recovery error/i)
})

test("death-screen disconnect, reconnect and world reload project only the saved player's maximum", (t) => {
    const a = new Player("lifecycle-a")
    const b = injured("lifecycle-b", 13)
    rosterSpawn(a)
    a.health = 0
    die(a)
    world.afterEvents.playerLeave.emit({ playerId: a.id })
    assert.equal(state(a.id).awaitingRespawn, true)
    assert.deepEqual(a.triggered, [], "the dead entity must not receive a cap")

    const returning = new Player(a.id)
    rosterSpawn(returning)
    assert.equal(state(a.id).awaitingRespawn, false)
    assert.equal(returning.healthMax, 18)
    assert.equal(b.healthMax, 13)

    const reopened = new Player(a.id)
    reopened.health = 6
    b.health = 5
    const eventsBefore = [...b.triggered]
    world.players = [reopened, b]
    t.after(() => { world.players = [] })
    world.afterEvents.worldLoad.emit()
    rosterSpawn(reopened)
    for (let i = 0; i < 20; i++) system.advance()
    assert.deepEqual([reopened.health, reopened.healthMax], [6, 18])
    assert.deepEqual(reopened.triggered, ["waveform_health:cap_18"])
    assert.deepEqual([b.health, b.healthMax], [5, 13])
    assert.deepEqual(b.triggered, eventsBefore)
    assert.deepEqual([state(a.id).lives, state(b.id).lives], [18, 13])
})

test("table-only full and half grants update native HP, with vanilla hunger under both settings", (t) => {
    t.after(() => saved.delete(PROGRESSIVE_HUNGER_KEY))
    for (const enabled of [false, true]) {
        if (enabled) saved.set(PROGRESSIVE_HUNGER_KEY, true)
        const a = injured(`health-table-${enabled}`, 18)
        const b = new Player(`other-${enabled}`)
        rosterSpawn(b)
        a.hunger.currentValue = 7
        a.health = 0
        die(a)
        a.health = a.healthMax
        world.afterEvents.playerSpawn.emit({ player: a, initialSpawn: false })
        assert.equal(a.healthMax, 16)
        assert.equal(a.messages.at(-1).includes("hunger target 8 icons (unenforced)"), enabled)
        a.health = 5
        interact(a, { block: tableAt("minecraft:dirt") })
        system.advance()
        assert.equal(a.healthMax, 16)
        assert.equal(a.inventory.getItem(0).amount, 3)
        interact(a)
        system.advance()
        assert.equal(a.healthMax, 18)
        assert.equal(a.inventory.getItem(0).amount, 2)
        a.inventory.setItem(0, new Stack(HALF, 2))
        interact(a)
        system.advance()
        assert.equal(a.healthMax, 19)
        assert.equal(a.inventory.getItem(0).amount, 1)
        assert.equal(a.messages.at(-1).includes("hunger target 9.5 icons (unenforced)"), enabled)
        a.inventory.setItem(0, new Stack(FULL, 1))
        interact(a)
        system.advance()
        assert.equal(a.healthMax, 19)
        assert.equal(a.inventory.getItem(0).amount, 1)
        a.inventory.setItem(0, new Stack(HALF, 1))
        interact(a)
        system.advance()
        assert.deepEqual([state(a.id).lives, a.healthMax, a.health], [20, 20, 5])
        assert.equal(a.inventory.getItem(0), undefined)
        assert.deepEqual(a.hunger, { currentValue: 7, effectiveMax: 20 })
        assert.equal(b.healthMax, 20)
        assert.deepEqual(b.triggered, [])
    }
})

test("living v2 balances use saved hearts independently; elimination never requests zero HP", () => {
    const a = new Player("v2-independent")
    const key = `waveform:hearts_lives.${a.id}`
    const record = '{"version":2,"lives":9,"hearts":5,"hunger":13,"awaitingRespawn":false,"recoveryReadyAt":201}'
    saved.set(key, record)
    rosterSpawn(a)
    assert.equal(a.healthMax, 5)
    assert.equal(saved.get(key), record)
    const zeroHearts = record.replace('"hearts":5', '"hearts":0')
    saved.set(key, zeroHearts)
    rosterSpawn(a)
    assert.equal(a.healthMax, 1)
    assert.equal(saved.get(key), zeroHearts)

    const b = injured("last-half", 3)
    for (const lives of [1, 0]) {
        system.advance()
        b.health = 0
        die(b)
        b.health = b.healthMax
        world.afterEvents.playerSpawn.emit({ player: b, initialSpawn: false })
        assert.equal(state(b.id).lives, lives)
        if (lives) assert.equal(b.healthMax, 1)
    }
    assert.equal(b.mode, GameMode.Spectator)
    assert.deepEqual(b.triggered, ["waveform_health:cap_3", "waveform_health:cap_1"])
    const host = new Player("reset-native-host")
    commands.get("waveform:reset_lives").execute({ sourceType: CustomCommandSource.Entity, sourceEntity: host }, [b])
    system.advance()
    assert.deepEqual([b.mode, state(b.id).lives, b.healthMax], [GameMode.Survival, 20, 20])
})

test("a failed native projection cannot repeat a committed recovery debit or grant", (t) => {
    const player = injured("retry-grant", 12)
    const ignored = t.mock.method(player, "triggerEvent", () => {})
    interact(player)
    system.advance()
    for (let i = 0; i < 60; i++) system.advance()
    assert.equal(ignored.mock.callCount(), 3)
    assert.equal(player.healthMax, 12)
    assert.equal(state(player.id).hearts, 14)
    assert.equal(player.inventory.getItem(0).amount, 2)
    assert.match(player.messages.at(-1), /could not be verified/)
    ignored.mock.restore()
    world.afterEvents.playerLeave.emit({ playerId: player.id })
    rosterSpawn(player)
    assert.equal(player.healthMax, 14)
    assert.equal(state(player.id).lives, 14)
    assert.equal(player.inventory.getItem(0).amount, 2)
})

test("unreadable progression blocks cap events and test reset; an invalid hunger preference only affects its display", (t) => {
    const a = new Player("unreadable")
    const key = `waveform:hearts_lives.${a.id}`
    const future = '{"version":99,"next":true}'
    saved.set(key, future)
    rosterSpawn(a)
    commands.get("waveform:reset_lives").execute({ sourceType: CustomCommandSource.Entity, sourceEntity: a }, [a])
    for (let i = 0; i < 60; i++) system.advance()
    assert.equal(saved.get(key), future)
    assert.deepEqual(a.triggered, [])

    saved.set(PROGRESSIVE_HUNGER_KEY, "unexpected")
    t.after(() => saved.delete(PROGRESSIVE_HUNGER_KEY))
    const b = injured("bad-hunger-only", 11)
    assert.equal(b.healthMax, 11)
    interact(b)
    system.advance()
    assert.equal(b.healthMax, 13)
    assert.equal(saved.get(PROGRESSIVE_HUNGER_KEY), "unexpected")
    assert.match(b.messages.at(-1), /unreadable hunger setting/)
})

test("a confirmed respawn rearms death accounting before native health becomes available", (t) => {
    const player = new Player("rapid-respawn")
    rosterSpawn(player)
    player.health = 0
    die(player)
    const get = player.getComponent.bind(player)
    const missing = t.mock.method(player, "getComponent", (type) => {
        if (type === mockBedrock.EntityComponentTypes.Health) throw new Error("respawn handle loading")
        return get(type)
    })
    world.afterEvents.playerSpawn.emit({ player, initialSpawn: false })
    assert.equal(state(player.id).awaitingRespawn, false)
    // Another real death, even in the same script tick, belongs to the new life.
    die(player)
    die(player)
    assert.equal(state(player.id).lives, 16)
    missing.mock.restore()
    player.health = 20
    world.afterEvents.playerSpawn.emit({ player, initialSpawn: false })
    assert.equal(player.healthMax, 16)
})

test("dropped death writes replay in lifecycle order across a second death and disconnect", (t) => {
    const player = new Player("save-order")
    rosterSpawn(player)
    const key = `waveform:hearts_lives.${player.id}`
    const write = world.setDynamicProperty.bind(world)
    let writable = false
    t.mock.method(world, "setDynamicProperty", (name, value) => {
        if (name !== key || writable) write(name, value)
    })
    t.mock.method(console, "warn", () => {})
    player.health = 0
    die(player)
    die(player)
    player.health = 20
    world.afterEvents.playerSpawn.emit({ player, initialSpawn: false })
    system.advance()
    player.health = 0
    die(player)
    world.afterEvents.playerLeave.emit({ playerId: player.id })
    assert.equal(state(player.id).lives, 20)
    writable = true
    for (let i = 0; i < 21; i++) system.advance()
    assert.equal(state(player.id).lives, 16)
    assert.equal(state(player.id).awaitingRespawn, true)
    const returning = new Player(player.id)
    rosterSpawn(returning)
    assert.equal(returning.healthMax, 16)
    assert.equal(state(player.id).awaitingRespawn, false)
})
