import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"
import { CustomCommandSource, CustomCommandStatus, EntityComponentTypes, system, world } from "./mock-bedrock.js"

const mockUrl = new URL("./mock-bedrock.js", import.meta.url).href
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@minecraft/server") return { shortCircuit: true, url: mockUrl }
        return nextResolve(specifier, context)
    },
})
const { installProbe } = await import("../.build/scripts/probe.js")
hooks.deregister()

function player(id) {
    const attribute = () => ({
        currentValue: 20,
        effectiveMax: 20,
        effectiveMin: 0,
        defaultValue: 20,
        setCurrentValue(value) { this.currentValue = value; return true },
        resetToMaxValue() { this.currentValue = this.effectiveMax },
    })
    const attributes = new Map(Object.values(EntityComponentTypes).map((type) => [type, attribute()]))
    return {
        id, name: id, typeId: "minecraft:player", isSprinting: false, attributes,
        events: [], messages: [],
        getComponent(type) { return this.attributes.get(type) },
        triggerEvent(event) { this.events.push(event) },
        sendMessage(message) { this.messages.push(message) },
    }
}

function fixture(t, stat) {
    const records = []
    t.mock.method(console, "warn", (line) => records.push(JSON.parse(line.slice("[NativeCaps] ".length))))
    const namespace = `native${stat}`
    const caps = stat === "health" ? [20, 18, 19, 10, 2] : [20, 18, 10, 6, 2]
    installProbe({ namespace, stat, caps })
    const commands = new Map()
    system.beforeEvents.startup.emit({
        customCommandRegistry: { registerCommand: (definition, run) => commands.set(definition.name, { definition, run }) },
    })
    function invoke(command, actor, points, sourceType = CustomCommandSource.Entity) {
        return commands.get(`${namespace}:${command}`).run({ sourceType, sourceEntity: actor }, points)
    }
    return { records, commands, invoke }
}

test("cap dispatch is deferred, per-player and observed without rewriting current values", (t) => {
    const { invoke, records, commands } = fixture(t, "health")
    const a = player("a")
    const b = player("b")
    assert.equal(commands.get("nativehealth:cap").definition.cheatsRequired, false)
    assert.equal(commands.get("nativehealth:cap").definition.permissionLevel, 0)
    assert.equal(invoke("cap", a, 18).status, CustomCommandStatus.Success)
    assert.deepEqual(a.events, [])
    system.advance(21)
    assert.deepEqual(a.events, ["nativehealth:cap_18"])
    assert.deepEqual(b.events, [])
    const trace = records.filter(({ kind }) => kind === "command")
    assert.deepEqual(trace.map(({ phase }) => phase), ["before", "immediate", "+1", "+20"])
    assert.ok(trace.every(({ player, attributes }) =>
        player.id === "a" && attributes.health.current === 20 && attributes.health.effectiveMax === 20))
    assert.match(trace[1].outcome, /returned without throwing/)
    invoke("reset", a)
    system.advance(21)
    assert.deepEqual(a.events, ["nativehealth:cap_18", "nativehealth:reset"])
})

test("unsupported cap, trigger error and invalid source are distinguishable", (t) => {
    const { invoke, records } = fixture(t, "health")
    const a = player("a")
    assert.equal(invoke("cap", a, 18, CustomCommandSource.Block).status, CustomCommandStatus.Failure)
    assert.equal(invoke("cap", undefined, 18).status, CustomCommandStatus.Failure)
    invoke("cap", a, 6)
    invoke("cap", a, 18)
    t.mock.method(a, "triggerEvent", () => { throw new Error("missing event") })
    system.advance(21)
    const errors = records.filter(({ phase }) => phase === "immediate").map(({ outcome }) => outcome.error)
    assert.match(errors[0], /Choose one of/)
    assert.match(errors[1], /missing event/)
})

test("current and refill controls leave effective maximum and other attributes alone", (t) => {
    const { invoke, commands } = fixture(t, "hunger")
    const a = player("a")
    assert.ok(commands.has("nativehunger:health"))
    invoke("current", a, 6)
    invoke("health", a, 17)
    system.advance(21)
    const hunger = a.attributes.get(EntityComponentTypes.Hunger)
    const health = a.attributes.get(EntityComponentTypes.Health)
    assert.equal(hunger.currentValue, 6)
    assert.equal(health.currentValue, 17)
    assert.equal(hunger.effectiveMax, 20)
    assert.equal(health.effectiveMax, 20)
    invoke("fill", a)
    system.advance(21)
    assert.equal(hunger.currentValue, 20)
    assert.equal(health.currentValue, 17)
    assert.deepEqual(a.events, [])
})

test("a missing component or throwing getter preserves the rest of the telemetry", (t) => {
    const { invoke, records } = fixture(t, "health")
    const a = player("a")
    a.attributes.delete(EntityComponentTypes.Saturation)
    Object.defineProperty(a.attributes.get(EntityComponentTypes.Health), "defaultValue", {
        get() { throw new Error("invalid default") },
    })
    invoke("status", a)
    system.advance(21)
    const { attributes } = records.find(({ phase }) => phase === "+20")
    assert.equal(attributes.health.effectiveMax, 20)
    assert.match(attributes.health.defaultValue.error, /invalid default/)
    assert.equal(attributes.saturation.unavailable, "component missing")
    assert.equal(attributes.hunger.current, 20)
})

test("respawn, leave, reconnect and sprint traces never reapply caps", (t) => {
    const { records } = fixture(t, "hunger")
    const a = player("a")
    world.players = [a]
    try {
        world.afterEvents.playerSpawn.emit({ player: a, initialSpawn: false })
        system.advance()
        a.isSprinting = true
        system.advance(20)
        world.afterEvents.playerLeave.emit({ playerId: a.id, playerName: a.name })
        const rejoined = player("a")
        world.players = [rejoined]
        world.afterEvents.playerSpawn.emit({ player: rejoined, initialSpawn: true })
        system.advance(21)
        assert.deepEqual(records.filter(({ kind }) => kind === "sprint").map(({ sprinting }) => sprinting),
            [false, true, false])
        assert.equal(records.find(({ kind }) => kind === "leave").player.id, "a")
        assert.deepEqual(records.filter(({ kind }) => kind === "spawn").map(({ initialSpawn }) => initialSpawn),
            [false, false, false, true, true, true])
        assert.deepEqual(a.events, [])
        assert.deepEqual(rejoined.events, [])
    } finally {
        world.players = []
    }
})
