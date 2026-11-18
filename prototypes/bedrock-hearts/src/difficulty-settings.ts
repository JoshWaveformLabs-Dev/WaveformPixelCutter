export const DIFFICULTY_PRESETS = ["easy", "normal", "hard", "extreme"] as const
export const MAX_RECOVERY_COOLDOWN_TICKS = 1200

export type DifficultyPreset = typeof DIFFICULTY_PRESETS[number]

export interface DifficultyPresetSettings {
    recoveryCooldownTicks: number
}

export interface DifficultySettings {
    version: 1
    activePreset: DifficultyPreset
    presets: Record<DifficultyPreset, DifficultyPresetSettings>
}

function defaultDifficultySettings(): DifficultySettings {
    // Provisional test plan values. Normal keeps the previous gameplay without a cooldown.
    return {
        version: 1,
        activePreset: "normal",
        presets: {
            easy: { recoveryCooldownTicks: 0 },
            normal: { recoveryCooldownTicks: 0 },
            hard: { recoveryCooldownTicks: 200 },
            extreme: { recoveryCooldownTicks: 400 },
        },
    }
}

export function isDifficultyPreset(value: unknown): value is DifficultyPreset {
    return DIFFICULTY_PRESETS.some((preset) => preset === value)
}

export function isRecoveryCooldownTicks(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) &&
        value >= 0 && value <= MAX_RECOVERY_COOLDOWN_TICKS
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validateEasyAndNormal(presets: DifficultySettings["presets"]): void {
    if (presets.easy.recoveryCooldownTicks > presets.normal.recoveryCooldownTicks) {
        throw new Error("Easy recovery cooldown cannot exceed Normal")
    }
}

export function decodeDifficultySettings(raw: unknown): DifficultySettings {
    const settings = defaultDifficultySettings()
    if (raw === undefined) {
        return settings
    }
    if (typeof raw !== "string") {
        throw new Error("Expected serialized difficulty settings")
    }

    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || (data.version !== 0 && data.version !== 1)) {
        throw new Error("Unsupported difficulty settings version")
    }
    if (!isDifficultyPreset(data.activePreset)) {
        throw new Error("Invalid active difficulty preset")
    }

    // The version 0 fixture stored a flat map of per-preset cooldowns.
    const entries = data.version === 0 ? data.recoveryCooldownTicks : data.presets
    if (!isRecord(entries)) {
        throw new Error("Invalid difficulty preset settings")
    }
    for (const preset of DIFFICULTY_PRESETS) {
        const entry = entries[preset]
        const ticks = data.version === 0 ? entry : isRecord(entry) ? entry.recoveryCooldownTicks : undefined
        if (!isRecoveryCooldownTicks(ticks)) {
            throw new Error(`Invalid ${preset} recovery cooldown`)
        }
        settings.presets[preset] = { recoveryCooldownTicks: ticks }
    }
    validateEasyAndNormal(settings.presets)
    return { ...settings, activePreset: data.activePreset }
}

export function encodeDifficultySettings(settings: DifficultySettings): string {
    return JSON.stringify(settings)
}

export function selectDifficultyPreset(settings: DifficultySettings, preset: DifficultyPreset): DifficultySettings {
    if (!isDifficultyPreset(preset)) {
        throw new Error("Invalid difficulty preset")
    }
    return { ...settings, activePreset: preset }
}

export function editRecoveryCooldown(
    settings: DifficultySettings,
    preset: DifficultyPreset,
    ticks: number,
): DifficultySettings {
    if (!isDifficultyPreset(preset)) {
        throw new Error("Invalid difficulty preset")
    }
    if (!isRecoveryCooldownTicks(ticks)) {
        throw new Error(`Recovery cooldown must be a whole number from 0 to ${MAX_RECOVERY_COOLDOWN_TICKS} ticks`)
    }
    const presets = {
        ...settings.presets,
        [preset]: { ...settings.presets[preset], recoveryCooldownTicks: ticks },
    }
    validateEasyAndNormal(presets)
    return { ...settings, presets }
}
