import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { test } from "node:test"
import * as mockBedrock from "./support/mock-bedrock.js"

const { Player, Stack, world, saved, system, GameMode, CustomCommandSource, CustomCommandStatus } = mockBedrock
const mockServerUrl = new URL("./support/mock-bedrock.js", import.meta.url).href
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@minecraft/server") return { shortCircuit: true, url: mockServerUrl }
        return nextResolve(specifier, context)
    },
})
await import("../.build/scripts/main.js")
hooks.deregister()

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
const use = (player, itemStack) => components.get("waveform:recover_capacity").onUse({ source: player, itemStack })

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
    use(rejoined, heart)
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

test("recovery adapter blocks repeated same-tick use and dispatches the correct heart", () => {
    const player = new Player("recovery")
    saved.set(`waveform:hearts_lives.${player.id}`, '{"version":1,"units":14}')
    rosterSpawn(player)
    const hearts = new Stack(FULL, 3)
    player.inventory.setItem(0, hearts)
    use(player, hearts)
    use(player, player.inventory.getItem(0))
    assert.equal(state(player.id).lives, 16)
    assert.equal(player.inventory.getItem(0).amount, 2)

    system.advance()
    const half = new Stack(HALF, 1)
    player.inventory.setItem(0, half)
    use(player, half)
    assert.equal(state(player.id).lives, 17)
    assert.equal(player.inventory.getItem(0), undefined)
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
