import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { beforeEach, test } from "node:test"
import * as mockBedrock from "./support/mock-bedrock.js"

const { CommandPermissionLevel, CustomCommandParamType, CustomCommandSource, CustomCommandStatus,
    Player, saved, system, world } = mockBedrock
const mockServerUrl = new URL("./support/mock-bedrock.js", import.meta.url).href
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === "@minecraft/server") return { shortCircuit: true, url: mockServerUrl }
        return nextResolve(specifier, context)
    },
})
const { DIFFICULTY_SETTINGS_KEY, readDifficultySettings } = await import("../.build/scripts/difficulty-bedrock.js")
hooks.deregister()

const VIEW = "waveform:difficulty_view"
const SELECT = "waveform:difficulty_select"
const COOLDOWN = "waveform:difficulty_cooldown"
const PRESET_ENUM = "waveform:difficulty_preset"
const HOST = new Player("host")
const GUEST = new Player("guest")
const definitionByName = new Map()
const enumByName = new Map()
const handlerByName = new Map()

system.beforeEvents.startup.emit({
    customCommandRegistry: {
        registerCommand(definition, execute) {
            assert.equal(definitionByName.has(definition.name), false)
            definitionByName.set(definition.name, definition)
            handlerByName.set(definition.name, execute)
        },
        registerEnum(name, values) { enumByName.set(name, values) },
    },
})

const playerOrigin = (player) => ({
    sourceType: CustomCommandSource.Entity,
    sourceEntity: player,
})

function execute(name, origin, permission, ...args) {
    // Model the engine's registered permission check before invoking the callback with cheats off.
    const definition = definitionByName.get(name)
    if (permission < definition.permissionLevel || definition.cheatsRequired !== false) {
        return { status: CustomCommandStatus.Failure }
    }
    return handlerByName.get(name)(origin, ...args)
}

function runAsHost(name, ...args) {
    return execute(name, playerOrigin(HOST), CommandPermissionLevel.Host, ...args)
}

beforeEach(() => {
    saved.clear()
    HOST.messages.length = 0
    HOST.isValid = true
})

test("all difficulty commands register host-only access and work with cheats off", () => {
    assert.deepEqual(enumByName.get(PRESET_ENUM), ["easy", "normal", "hard", "extreme"])
    for (const name of [VIEW, SELECT, COOLDOWN]) {
        assert.equal(definitionByName.get(name).permissionLevel, CommandPermissionLevel.Host)
        assert.equal(definitionByName.get(name).cheatsRequired, false)
    }
    assert.deepEqual(definitionByName.get(SELECT).mandatoryParameters, [
        { name: PRESET_ENUM, type: CustomCommandParamType.Enum },
    ])
    assert.deepEqual(definitionByName.get(COOLDOWN).mandatoryParameters, [
        { name: PRESET_ENUM, type: CustomCommandParamType.Enum },
        { name: "ticks", type: CustomCommandParamType.Integer },
    ])

    assert.equal(runAsHost(VIEW).status, CustomCommandStatus.Success)
    assert.deepEqual(HOST.messages, [])
    system.advance()
    assert.match(HOST.messages.at(-1), /active preset is Normal/)
    assert.match(HOST.messages.at(-1), /Provisional recovery cooldowns in ticks.*Easy 0.*Normal 0.*Hard 200.*Extreme 400/)
    assert.equal(saved.has(DIFFICULTY_SETTINGS_KEY), false)
})

test("normal guests, ordinary operators and non-player origins cannot change settings", () => {
    for (const permission of [0, CommandPermissionLevel.Host - 1]) {
        assert.equal(execute(SELECT, playerOrigin(GUEST), permission, "hard").status, CustomCommandStatus.Failure)
        assert.equal(execute(COOLDOWN, playerOrigin(GUEST), permission, "easy", 42).status, CustomCommandStatus.Failure)
    }
    for (const origin of [
        { sourceType: CustomCommandSource.Block, sourceEntity: HOST },
        playerOrigin({ typeId: "minecraft:zombie" }),
    ]) {
        assert.equal(execute(SELECT, origin, CommandPermissionLevel.Host, "hard").status, CustomCommandStatus.Failure)
    }
    system.advance()
    assert.equal(saved.has(DIFFICULTY_SETTINGS_KEY), false)
})

test("malformed commands and a host disconnect before execution cause no writes", () => {
    assert.equal(runAsHost(SELECT, "peaceful").status, CustomCommandStatus.Failure)
    for (const [preset, ticks] of [["bad", 42], ["easy", "100"], ["hard", -1], ["hard", 1201], ["normal", 1.5], ["easy", NaN]]) {
        assert.equal(runAsHost(COOLDOWN, preset, ticks).status, CustomCommandStatus.Failure)
    }
    assert.equal(runAsHost(SELECT, "extreme").status, CustomCommandStatus.Success)
    HOST.isValid = false
    system.advance()
    assert.equal(saved.has(DIFFICULTY_SETTINGS_KEY), false)
    assert.deepEqual(HOST.messages, [])
})

test("host edits independently and persists selection and both endpoints without touching player data", (t) => {
    const playerKey = "waveform:hearts_lives.guest"
    const playerRecord = '{"version":2,"lives":14,"hearts":14,"hunger":14,"awaitingRespawn":false}'
    saved.set(playerKey, playerRecord)
    const defaults = readDifficultySettings()

    assert.equal(runAsHost(COOLDOWN, "hard", 1200).status, CustomCommandStatus.Success)
    assert.equal(runAsHost(COOLDOWN, "extreme", 0).status, CustomCommandStatus.Success)
    assert.equal(runAsHost(SELECT, "easy").status, CustomCommandStatus.Success)
    assert.equal(saved.has(DIFFICULTY_SETTINGS_KEY), false)
    system.advance()
    assert.match(HOST.messages[0], /provisional Hard recovery cooldown at 1200 ticks/)
    assert.match(HOST.messages[1], /provisional Extreme recovery cooldown at 0 ticks/)
    assert.match(HOST.messages[2], /Saved Easy as the active preset/)
    assert.equal(saved.get(playerKey), playerRecord)

    // Read through a fresh world-store snapshot, as on a reload.
    const reloaded = new Map(saved)
    saved.clear()
    t.mock.method(world, "getDynamicProperty", (key) => reloaded.get(key))
    const settings = readDifficultySettings()
    assert.deepEqual(settings, {
        ...defaults,
        activePreset: "easy",
        presets: {
            ...defaults.presets,
            hard: { recoveryCooldownTicks: 1200 },
            extreme: { recoveryCooldownTicks: 0 },
        },
    })
})

test("legacy config is readable without writing and migrates on the next valid edit", () => {
    const legacy = JSON.stringify({
        version: 0,
        activePreset: "hard",
        recoveryCooldownTicks: { easy: 19, normal: 25, hard: 201, extreme: 402 },
    })
    saved.set(DIFFICULTY_SETTINGS_KEY, legacy)
    assert.equal(runAsHost(VIEW).status, CustomCommandStatus.Success)
    system.advance()
    assert.match(HOST.messages.at(-1), /active preset is Hard/)
    assert.equal(saved.get(DIFFICULTY_SETTINGS_KEY), legacy)

    assert.equal(runAsHost(COOLDOWN, "extreme", 500).status, CustomCommandStatus.Success)
    system.advance()
    assert.deepEqual(JSON.parse(saved.get(DIFFICULTY_SETTINGS_KEY)), {
        version: 1,
        activePreset: "hard",
        presets: {
            easy: { recoveryCooldownTicks: 19 },
            normal: { recoveryCooldownTicks: 25 },
            hard: { recoveryCooldownTicks: 201 },
            extreme: { recoveryCooldownTicks: 500 },
        },
    })
})

test("corrupt and future records produce a host error and are preserved", (t) => {
    t.mock.method(console, "warn", () => {})
    for (const raw of ["{broken", '{"version":42}', 42]) {
        saved.set(DIFFICULTY_SETTINGS_KEY, raw)
        assert.equal(runAsHost(VIEW).status, CustomCommandStatus.Success)
        assert.equal(runAsHost(SELECT, "hard").status, CustomCommandStatus.Success)
        assert.equal(runAsHost(COOLDOWN, "normal", 7).status, CustomCommandStatus.Success)
        system.advance()
        assert.equal(saved.get(DIFFICULTY_SETTINGS_KEY), raw)
        assert.ok(HOST.messages.slice(-3).every((message) => /Difficulty settings error/.test(message)))
    }
})

test("an unconfirmed settings write reports failure without claiming success", (t) => {
    t.mock.method(console, "warn", () => {})
    t.mock.method(world, "setDynamicProperty", () => {})
    assert.equal(runAsHost(SELECT, "hard").status, CustomCommandStatus.Success)
    system.advance()
    assert.equal(saved.has(DIFFICULTY_SETTINGS_KEY), false)
    assert.match(HOST.messages.at(-1), /Could not verify saved settings/)
})

test("host edits enforce Easy at or below Normal without modifying the other preset", (t) => {
    t.mock.method(console, "warn", () => {})
    runAsHost(COOLDOWN, "easy", 100)
    system.advance()
    assert.equal(saved.has(DIFFICULTY_SETTINGS_KEY), false)
    assert.match(HOST.messages.at(-1), /Easy recovery cooldown cannot exceed Normal/)
    runAsHost(COOLDOWN, "normal", 100)
    runAsHost(COOLDOWN, "easy", 100)
    system.advance()
    const savedSettings = saved.get(DIFFICULTY_SETTINGS_KEY)
    const { presets } = readDifficultySettings()
    assert.equal(presets.easy.recoveryCooldownTicks, 100)
    assert.equal(presets.normal.recoveryCooldownTicks, 100)
    runAsHost(COOLDOWN, "normal", 0)
    system.advance()
    assert.equal(saved.get(DIFFICULTY_SETTINGS_KEY), savedSettings)
    assert.match(HOST.messages.at(-1), /Easy recovery cooldown cannot exceed Normal/)
})
