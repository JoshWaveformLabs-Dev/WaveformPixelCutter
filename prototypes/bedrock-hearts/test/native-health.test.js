import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"
import { Player, system } from "./support/mock-bedrock.js"
import { initialState } from "../.build/scripts/lives-state.js"

const mockServer = new URL("./support/mock-bedrock.js", import.meta.url).href
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@minecraft/server") return { shortCircuit: true, url: mockServer }
        return nextResolve(specifier, context)
    },
})
const { reconcileNativeHealth, cancelHealthSync } = await import("../.build/scripts/native-health.js")
hooks.deregister()

function advance(ticks) {
    for (let i = 0; i < ticks; i++) system.advance()
}

function sync(player, hearts) {
    reconcileNativeHealth(player, "test", () => ({ ...initialState(), hearts }))
}

function healthLog(t) {
    const entries = []
    function capture(line) {
        entries.push(JSON.parse(line.slice(line.indexOf("{"))))
    }
    t.mock.method(console, "log", capture)
    t.mock.method(console, "warn", capture)
    return entries
}

test("each full and half-heart target including the return to 20 is dispatched and measured", (t) => {
    const log = healthLog(t)
    const player = new Player("range")
    for (let target = 1; target <= 20; target++) {
        sync(player, target)
        advance(20)
        const result = log.at(-1)
        assert.equal(result.event, "native_health_verified")
        assert.equal(result.effectiveMax, target)
        assert.equal(result.targetMax, target)
        assert.equal(player.triggered.at(-1), `waveform_health:cap_${target}`)
    }
    assert.equal(player.triggered.length, 20)
    assert.equal(player.health, 1, "growing the cap must not heal a damaged player")
    assert.deepEqual(player.hunger, { currentValue: 20, effectiveMax: 20 })
})

test("matching native capacity leaves ordinary damage and regeneration alone", (t) => {
    const log = healthLog(t)
    const player = new Player("vanilla")
    player.healthMax = 11
    player.health = 7
    sync(player, 11)
    player.health = 5
    advance(1)
    player.health = 6
    advance(59)
    assert.equal(player.health, 6)
    assert.deepEqual(player.triggered, [])
    assert.equal(log.at(-1).dispatches, 0)
})

test("a delayed group refill is corrected once across overlapping world-load and spawn requests", (t) => {
    const log = healthLog(t)
    const player = new Player("overlap")
    player.health = 4.5
    const apply = player.triggerEvent.bind(player)
    const dispatch = t.mock.method(player, "triggerEvent", (name) => system.runTimeout(() => apply(name), 1))
    sync(player, 9)
    sync(player, 9)
    assert.equal(player.healthMax, 20)
    assert.deepEqual(log, [])
    advance(1)
    assert.equal(player.healthMax, 9)
    assert.equal(player.health, 4.5)
    player.health = 3
    advance(19)
    assert.equal(log.at(-1).effectiveMax, 9)
    assert.equal(player.health, 3)
    assert.equal(dispatch.mock.callCount(), 1)
})

test("delayed observation leaves intervening combat damage intact", (t) => {
    healthLog(t)
    const player = new Player("damage")
    player.health = 4
    const apply = player.triggerEvent.bind(player)
    t.mock.method(player, "triggerEvent", (name) => system.runTimeout(() => {
        apply(name)
        player.health = 2
    }, 1))
    sync(player, 13)
    advance(20)
    assert.equal(player.health, 2)
})

test("a superseded engine event arriving after the first read is repaired to the newest saved target", (t) => {
    const log = healthLog(t)
    const player = new Player("retarget")
    const apply = player.triggerEvent.bind(player)
    t.mock.method(player, "triggerEvent", (name) => system.runTimeout(() => apply(name), 2))
    sync(player, 10)
    sync(player, 20)
    advance(2)
    assert.equal(player.healthMax, 10)
    assert.deepEqual(log, [])
    advance(38)
    assert.equal(player.healthMax, 20)
    assert.deepEqual(player.triggered, ["waveform_health:cap_10", "waveform_health:cap_20"])
    assert.deepEqual(log.map((entry) => entry.effectiveMax), [20])
})

test("an accepted no-op and a throwing dispatch both fail verification after bounded retries", (t) => {
    const log = healthLog(t)
    for (const failure of ["ignored", "threw"]) {
        const player = new Player(failure)
        player.health = 6
        const dispatch = t.mock.method(player, "triggerEvent", () => {
            if (failure === "threw") throw new Error("missing event")
        })
        sync(player, 8)
        advance(80)
        assert.equal(dispatch.mock.callCount(), 3)
        const entries = log.filter((entry) => entry.playerId === failure)
        assert.deepEqual(entries.map((entry) => entry.event), ["native_health_unverified"])
        assert.equal(entries[0].targetMax, 8)
        assert.equal(entries[0].effectiveMax, 20)
        assert.equal(player.health, 6)
        assert.match(player.messages.at(-1), /could not be verified/i)
    }
})

test("transient component loss and an ignored first request recover without repeating progression", (t) => {
    const log = healthLog(t)
    const player = new Player("late")
    const getComponent = player.getComponent.bind(player)
    t.mock.method(player, "getComponent", (type) => system.currentTick < readyAt ? undefined : getComponent(type))
    const readyAt = system.currentTick + 3
    const apply = player.triggerEvent.bind(player)
    let attempts = 0
    t.mock.method(player, "triggerEvent", (name) => { if (++attempts > 1) apply(name) })
    const load = t.mock.fn(() => ({ ...initialState(), hearts: 17 }))
    reconcileNativeHealth(player, "spawn", load)
    advance(60)
    assert.equal(load.mock.callCount(), 1)
    assert.equal(attempts, 2)
    assert.equal(log.at(-1).effectiveMax, 17)
})

test("Health Boost defers the base cap until the effect clears and leave cancels pending work", (t) => {
    const log = healthLog(t)
    const players = [new Player("boost"), new Player("leave")]
    for (const player of players) {
        player.healthMax = 24
        player.effects.set("health_boost", {})
        sync(player, 15)
    }
    advance(40)
    cancelHealthSync("leave")
    for (const player of players) {
        assert.deepEqual(player.triggered, [])
        player.effects.clear()
        player.healthMax = 20
    }
    advance(40)
    assert.equal(players[0].healthMax, 15)
    assert.equal(players[1].healthMax, 20)
    assert.equal(log.filter((entry) => entry.event === "native_health_deferred_boost").length, 2)
})
