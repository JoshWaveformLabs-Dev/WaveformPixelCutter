export const MAX_UNITS = 20

export interface LifeState {
    version: 2
    lives: number
    hearts: number
    hunger: number
    awaitingRespawn: boolean
}

export type RecoveryUnits = 1 | 2
type Denial = "eliminated" | "awaiting_respawn" | "over_cap"
type RecoveryPlan = { state: LifeState } | { denial: Denial }

export function initialState(): LifeState {
    return { version: 2, lives: MAX_UNITS, hearts: MAX_UNITS, hunger: MAX_UNITS, awaitingRespawn: false }
}

export function isEliminated(state: LifeState): boolean {
    return state.lives === 0
}

export function deductDeath(state: LifeState): LifeState {
    if (state.awaitingRespawn || isEliminated(state)) {
        return state
    }
    return {
        ...state,
        lives: Math.max(0, state.lives - 2),
        hearts: Math.max(0, state.hearts - 2),
        hunger: Math.max(0, state.hunger - 2),
        awaitingRespawn: true,
    }
}

export function planRecovery(state: LifeState, units: RecoveryUnits): RecoveryPlan {
    if (isEliminated(state)) {
        return { denial: "eliminated" }
    }
    if (state.awaitingRespawn) {
        return { denial: "awaiting_respawn" }
    }
    const lives = state.lives + units
    const hearts = state.hearts + units
    const hunger = state.hunger + units
    if (Math.max(lives, hearts, hunger) > MAX_UNITS) {
        return { denial: "over_cap" }
    }
    return { state: { ...state, lives, hearts, hunger } }
}

function isUnits(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_UNITS
}

// V1 is the compact linked-balance migration fixture. The probe-only pack wrote no life records.
export function decodeState(raw: unknown): LifeState {
    if (raw === undefined) {
        return initialState()
    }
    if (typeof raw !== "string") {
        throw new Error("Expected serialized Hearts & Lives state")
    }
    const data: unknown = JSON.parse(raw)
    if (typeof data !== "object" || data === null || !("version" in data)) {
        throw new Error("Invalid Hearts & Lives state")
    }
    if (data.version === 1 && "units" in data && isUnits(data.units)) {
        return { ...initialState(), lives: data.units, hearts: data.units, hunger: data.units }
    }
    if (data.version === 2 &&
        "lives" in data && isUnits(data.lives) &&
        "hearts" in data && isUnits(data.hearts) &&
        "hunger" in data && isUnits(data.hunger) &&
        "awaitingRespawn" in data && typeof data.awaitingRespawn === "boolean") {
        return {
            version: 2, lives: data.lives, hearts: data.hearts, hunger: data.hunger,
            awaitingRespawn: data.awaitingRespawn,
        }
    }
    throw new Error("Unsupported or invalid Hearts & Lives state")
}

export function encodeState(state: LifeState): string {
    return JSON.stringify(state)
}
