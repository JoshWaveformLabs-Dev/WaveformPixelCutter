import { system, world } from "@minecraft/server"

const KEY = "waveform:hearts_lives_recovery_clock"

interface Checkpoint {
    tick: number
    activeUntil: number
}

let checkpoint: Checkpoint | undefined
let checkpointScriptTick = 0
let reportedFailure = false

function load(): Checkpoint {
    const raw = world.getDynamicProperty(KEY)
    if (raw === undefined) return { tick: 0, activeUntil: 0 }
    if (typeof raw !== "string") throw new Error("Expected serialized recovery clock")
    const data: unknown = JSON.parse(raw)
    if (typeof data !== "object" || data === null ||
        !("tick" in data) || typeof data.tick !== "number" || !Number.isSafeInteger(data.tick) || data.tick < 0 ||
        !("activeUntil" in data) || typeof data.activeUntil !== "number" ||
        !Number.isSafeInteger(data.activeUntil) || data.activeUntil < data.tick) {
        throw new Error("Invalid recovery clock")
    }
    return { tick: data.tick, activeUntil: data.activeUntil }
}

function current(): Checkpoint {
    if (checkpoint === undefined) {
        checkpoint = load()
        checkpointScriptTick = system.currentTick
    }
    const elapsedTicks = system.currentTick - checkpointScriptTick
    return {
        tick: Math.min(checkpoint.activeUntil, checkpoint.tick + elapsedTicks),
        activeUntil: checkpoint.activeUntil,
    }
}

function save(value: Checkpoint): void {
    const encoded = JSON.stringify(value)
    world.setDynamicProperty(KEY, encoded)
    if (world.getDynamicProperty(KEY) !== encoded) {
        throw new Error("Could not verify the saved recovery clock")
    }
    checkpoint = value
    checkpointScriptTick = system.currentTick
}

export function getRecoveryTick(): number {
    return current().tick
}

// Reserve enough ticking time before committing an expiry. Only a verified grant
// writes a deadline to the player's record.
export function reserveRecoveryTick(readyAt: number): void {
    const value = current()
    if (readyAt > value.activeUntil) {
        save({ tick: value.tick, activeUntil: readyAt })
    }
}

function checkpointClock(): void {
    try {
        const value = current()
        if (value.tick !== checkpoint?.tick) save(value)
        reportedFailure = false
    } catch (error) {
        if (!reportedFailure) {
            console.warn(`[Hearts & Lives] Recovery clock checkpoint failed: ${String(error)}`)
            reportedFailure = true
        }
    }
}

world.afterEvents.worldLoad.subscribe(() => {
    checkpoint = undefined
    checkpointClock()
})
system.runInterval(() => {
    if (checkpoint !== undefined && checkpoint.tick < checkpoint.activeUntil) {
        checkpointClock()
    }
}, 1)
