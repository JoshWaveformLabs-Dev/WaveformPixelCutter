import { decodeState, deductDeath, encodeState } from "./lives-state.js"
import type { LifeState } from "./lives-state.js"

export interface LifeStore {
    read(playerId: string): unknown
    write(playerId: string, encoded: string): void
}

// A throwing setter can still have committed the write. Always use readback
// before releasing an eliminated player or projecting a migrated/debited cap.
export function writeVerified(store: LifeStore, playerId: string, encoded: string): void {
    let writeError: unknown
    try {
        store.write(playerId, encoded)
    } catch (error) {
        writeError = error
    }
    if (store.read(playerId) !== encoded) {
        throw new Error(`Could not verify the life record for ${playerId}. ${writeError ?? ""}`)
    }
}

export function reconcileSpawn(
    store: LifeStore,
    playerId: string,
    alive: boolean,
    applyMode?: (state: LifeState) => void,
): LifeState {
    const raw = store.read(playerId)
    const state = decodeState(raw)
    if (alive) {
        applyMode?.(state)
        state.awaitingRespawn = false
    }
    const encoded = encodeState(state)
    if (raw !== encoded) {
        writeVerified(store, playerId, encoded)
    }
    return state
}

export function recordDeath(store: LifeStore, playerId: string): LifeState | undefined {
    const before = decodeState(store.read(playerId))
    const after = deductDeath(before)
    if (before === after) {
        return undefined
    }
    writeVerified(store, playerId, encodeState(after))
    return after
}

/** Suppresses callbacks for an already processed player until the next script tick. */
export class TickGate {
    private tick: number | undefined
    private seen = new Set<string>()

    enter(playerId: string, tick: number): boolean {
        if (this.tick !== tick) {
            this.seen.clear()
            this.tick = tick
        }
        if (this.seen.has(playerId)) {
            return false
        }
        this.seen.add(playerId)
        return true
    }
}
