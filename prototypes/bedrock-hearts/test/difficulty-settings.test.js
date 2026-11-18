import assert from "node:assert/strict"
import { test } from "node:test"
import {
    decodeDifficultySettings,
    DIFFICULTY_PRESETS,
    editRecoveryCooldown,
    encodeDifficultySettings,
    isDifficultyPreset,
    isRecoveryCooldownTicks,
    MAX_RECOVERY_COOLDOWN_TICKS,
    selectDifficultyPreset,
} from "../.build/scripts/difficulty-settings.js"

const cooldowns = (settings) => DIFFICULTY_PRESETS.map((name) => settings.presets[name].recoveryCooldownTicks)

test("an absent configuration defaults to Normal with provisional independent cooldowns", () => {
    const settings = decodeDifficultySettings(undefined)
    assert.equal(settings.version, 1)
    assert.equal(settings.activePreset, "normal")
    assert.deepEqual(cooldowns(settings), [0, 0, 200, 400])

    settings.presets.normal.recoveryCooldownTicks = 9
    assert.equal(decodeDifficultySettings(undefined).presets.normal.recoveryCooldownTicks, 0)
})

test("selecting and editing individual presets round-trips without changing the other presets", () => {
    const initial = decodeDifficultySettings(undefined)
    const hard = selectDifficultyPreset(initial, "hard")
    const edited = editRecoveryCooldown(hard, "extreme", MAX_RECOVERY_COOLDOWN_TICKS)
    assert.equal(edited.activePreset, "hard")
    assert.equal(initial.activePreset, "normal")
    assert.deepEqual(cooldowns(hard), [0, 0, 200, 400])
    assert.deepEqual(cooldowns(edited), [0, 0, 200, 1200])
    assert.deepEqual(decodeDifficultySettings(encodeDifficultySettings(edited)), edited)
    assert.equal(editRecoveryCooldown(edited, "hard", 0).presets.hard.recoveryCooldownTicks, 0)
})

test("version 0 cooldowns and selected preset migrate to the nested version 1 settings", () => {
    const legacy = JSON.stringify({
        version: 0,
        activePreset: "extreme",
        recoveryCooldownTicks: { easy: 3, normal: 17, hard: 1, extreme: 5 },
    })
    const migrated = decodeDifficultySettings(legacy)
    assert.equal(migrated.version, 1)
    assert.equal(migrated.activePreset, "extreme")
    assert.deepEqual(cooldowns(migrated), [3, 17, 1, 5])
    const updated = editRecoveryCooldown(migrated, "easy", 12)
    assert.deepEqual(decodeDifficultySettings(encodeDifficultySettings(updated)), updated)
})

test("malformed and future settings fail instead of falling back to writable defaults", () => {
    const valid = decodeDifficultySettings(undefined)
    const invalid = [
        0, false, null, "not json", "null", "[]", "{}",
        JSON.stringify({ ...valid, version: 2 }),
        JSON.stringify({ ...valid, activePreset: "nightmare" }),
        JSON.stringify({ ...valid, presets: null }),
        JSON.stringify({ ...valid, presets: { ...valid.presets, hard: {} } }),
        JSON.stringify({ ...valid, presets: { ...valid.presets, normal: { recoveryCooldownTicks: -1 } } }),
        JSON.stringify({ version: 0, activePreset: "hard", recoveryCooldownTicks: { hard: 5 } }),
    ]
    for (const raw of invalid) {
        assert.throws(() => decodeDifficultySettings(raw), Error, JSON.stringify(raw))
    }
})

test("command validation accepts only known preset IDs and integer cooldowns in range", () => {
    const settings = decodeDifficultySettings(undefined)
    assert.ok(DIFFICULTY_PRESETS.every(isDifficultyPreset))
    for (const preset of ["Normal", "", "constructor", "__proto__", 0, undefined]) {
        assert.equal(isDifficultyPreset(preset), false)
        assert.throws(() => selectDifficultyPreset(settings, preset), /Invalid difficulty preset/)
        assert.throws(() => editRecoveryCooldown(settings, preset, 0), /Invalid difficulty preset/)
    }

    assert.ok([0, 1, 1199, 1200].every(isRecoveryCooldownTicks))
    for (const ticks of [-1, 0.5, 1201, NaN, Infinity, "100", undefined]) {
        assert.equal(isRecoveryCooldownTicks(ticks), false)
        assert.throws(() => editRecoveryCooldown(settings, "normal", ticks), /whole number/)
    }
})

test("Easy and Normal remain independently editable with Easy at or below Normal", () => {
    const settings = decodeDifficultySettings(undefined)
    assert.throws(() => editRecoveryCooldown(settings, "easy", 100), /Easy recovery cooldown cannot exceed Normal/)
    const normal = editRecoveryCooldown(settings, "normal", 200)
    assert.equal(normal.presets.easy.recoveryCooldownTicks, 0)
    const easy = editRecoveryCooldown(normal, "easy", 100)
    assert.deepEqual(cooldowns(easy), [100, 200, 200, 400])
    assert.equal(editRecoveryCooldown(easy, "normal", 100).presets.easy.recoveryCooldownTicks, 100)
    assert.throws(() => editRecoveryCooldown(easy, "normal", 99), /Easy recovery cooldown cannot exceed Normal/)
    assert.throws(() => decodeDifficultySettings(encodeDifficultySettings({
        ...easy, presets: { ...easy.presets, normal: { recoveryCooldownTicks: 0 } },
    })), /Easy recovery cooldown cannot exceed Normal/)
})
