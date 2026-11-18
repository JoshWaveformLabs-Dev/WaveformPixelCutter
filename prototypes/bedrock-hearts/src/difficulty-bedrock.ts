import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandSource,
    CustomCommandStatus,
    Player,
    system,
    world,
} from "@minecraft/server"
import type { CustomCommandOrigin, CustomCommandResult } from "@minecraft/server"
import {
    decodeDifficultySettings,
    decodeProgressiveHungerEnabled,
    DIFFICULTY_PRESETS,
    editRecoveryCooldown,
    encodeDifficultySettings,
    isDifficultyPreset,
    isRecoveryCooldownTicks,
    MAX_RECOVERY_COOLDOWN_TICKS,
    selectDifficultyPreset,
} from "./difficulty-settings.js"
import type { DifficultyPreset, DifficultySettings } from "./difficulty-settings.js"

export const DIFFICULTY_SETTINGS_KEY = "waveform:hearts_lives_difficulty"
export const PROGRESSIVE_HUNGER_KEY = "waveform:hearts_lives_progressive_hunger"

const LABEL = "[Hearts & Lives]"
const PRESET_ENUM = "waveform:difficulty_preset"
const HUNGER_MODE_ENUM = "waveform:progressive_hunger_mode"
const NAMES: Record<DifficultyPreset, string> = {
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    extreme: "Extreme",
}

export function readDifficultySettings(): DifficultySettings {
    return decodeDifficultySettings(world.getDynamicProperty(DIFFICULTY_SETTINGS_KEY))
}

export function readProgressiveHungerEnabled(): boolean {
    return decodeProgressiveHungerEnabled(world.getDynamicProperty(PROGRESSIVE_HUNGER_KEY))
}

function writeVerifiedSetting(key: string, value: string | boolean): void {
    let writeFailure: unknown
    try {
        world.setDynamicProperty(key, value)
    } catch (error) {
        writeFailure = error
    }
    if (world.getDynamicProperty(key) !== value) {
        throw new Error(`Could not verify saved settings. ${writeFailure === undefined ? "Read them back before retrying." : String(writeFailure)}`)
    }
}

function updateSettings(update: (settings: DifficultySettings) => DifficultySettings): void {
    const encoded = encodeDifficultySettings(update(readDifficultySettings()))
    writeVerifiedSetting(DIFFICULTY_SETTINGS_KEY, encoded)
}

function describeProgressiveHunger(enabled: boolean): string {
    return enabled
        ? "Progressive hunger is ON. Each player's saved hunger sets an unenforced target. The native hunger bar uses vanilla rules."
        : "Progressive hunger is OFF. The native hunger bar uses vanilla rules."
}

function describeSettings(settings: DifficultySettings, progressiveHungerEnabled: boolean): string {
    const cooldowns = DIFFICULTY_PRESETS.map(
        (preset) => `${NAMES[preset]} ${settings.presets[preset].recoveryCooldownTicks}`,
    )
    return [
        `The active preset is ${NAMES[settings.activePreset]}.`,
        `Provisional recovery cooldowns in ticks are ${cooldowns.join(", ")}.`,
        describeProgressiveHunger(progressiveHungerEnabled),
    ].join(" ")
}

function failed(message: string): CustomCommandResult {
    return { status: CustomCommandStatus.Failure, message }
}

function schedule(origin: CustomCommandOrigin, operation: () => string): CustomCommandResult {
    const player = origin.sourceEntity
    if (origin.sourceType !== CustomCommandSource.Entity || !(player instanceof Player)) {
        return failed("Run this command as the host player.")
    }

    // The custom command registry enforces Host permission. World access is deferred from restricted execution.
    system.run(() => {
        if (!player.isValid) {
            return
        }
        let message: string
        try {
            message = operation()
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error)
            console.warn(`${LABEL} Difficulty settings error. ${detail}`)
            message = `Difficulty settings error. ${detail}`
        }
        if (player.isValid) {
            try {
                player.sendMessage(`${LABEL} ${message}`)
            } catch (error) {
                console.warn(`${LABEL} Difficulty reply failed. ${String(error)}`)
            }
        }
    })
    return { status: CustomCommandStatus.Success, message: "Difficulty command queued." }
}

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    const access = { permissionLevel: CommandPermissionLevel.Host, cheatsRequired: false }
    const presetParameter = { name: PRESET_ENUM, type: CustomCommandParamType.Enum }

    customCommandRegistry.registerEnum(PRESET_ENUM, [...DIFFICULTY_PRESETS])
    customCommandRegistry.registerEnum(HUNGER_MODE_ENUM, ["on", "off"])
    customCommandRegistry.registerCommand({
        ...access,
        name: "waveform:difficulty_view",
        description: "View the active preset, provisional recovery cooldowns and progressive hunger setting",
    }, (origin) => schedule(origin, () => describeSettings(readDifficultySettings(), readProgressiveHungerEnabled())))

    customCommandRegistry.registerCommand({
        ...access,
        name: "waveform:difficulty_hunger",
        description: "Enable or disable the world's progressive hunger target",
        mandatoryParameters: [{ name: HUNGER_MODE_ENUM, type: CustomCommandParamType.Enum }],
    }, (origin, mode: unknown) => {
        if (mode !== "on" && mode !== "off") {
            return failed("Choose on or off.")
        }
        return schedule(origin, () => {
            // Refuse to overwrite an unreadable hunger value.
            readProgressiveHungerEnabled()
            const enabled = mode === "on"
            writeVerifiedSetting(PROGRESSIVE_HUNGER_KEY, enabled)
            return describeProgressiveHunger(enabled)
        })
    })

    customCommandRegistry.registerCommand({
        ...access,
        name: "waveform:difficulty_select",
        description: "Select the active Hearts & Lives difficulty preset",
        mandatoryParameters: [presetParameter],
    }, (origin, preset: unknown) => {
        if (!isDifficultyPreset(preset)) {
            return failed("Choose easy, normal, hard or extreme.")
        }
        return schedule(origin, () => {
            updateSettings((settings) => selectDifficultyPreset(settings, preset))
            return `Saved ${NAMES[preset]} as the active preset.`
        })
    })

    customCommandRegistry.registerCommand({
        ...access,
        name: "waveform:difficulty_cooldown",
        description: "Set a preset's provisional recovery cooldown in gameplay ticks",
        mandatoryParameters: [presetParameter, { name: "ticks", type: CustomCommandParamType.Integer }],
    }, (origin, preset: unknown, ticks: unknown) => {
        if (!isDifficultyPreset(preset)) {
            return failed("Choose easy, normal, hard or extreme.")
        }
        if (!isRecoveryCooldownTicks(ticks)) {
            return failed(`Enter a whole number from 0 to ${MAX_RECOVERY_COOLDOWN_TICKS} ticks.`)
        }
        return schedule(origin, () => {
            updateSettings((settings) => editRecoveryCooldown(settings, preset, ticks))
            return `Saved the provisional ${NAMES[preset]} recovery cooldown at ${ticks} ticks.`
        })
    })
})
