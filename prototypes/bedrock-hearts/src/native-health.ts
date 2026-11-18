import { EntityComponentTypes, system } from "@minecraft/server"
import type { EntityHealthComponent, Player } from "@minecraft/server"
import { isEliminated } from "./lives-state.js"
import type { LifeState } from "./lives-state.js"

// Entity events can apply on the next entity tick. Give each dispatch a full
// second to settle before reissuing it, then take one final read-only sample.
const SAMPLE_TICKS = [0, 1, 20, 21, 40, 41, 60]
interface HealthSync {
    player: Player
    before?: { current: number; target: number; tick: number }
}
const pending = new Map<string, HealthSync>()

export function cancelHealthSync(playerId: string): void {
    pending.delete(playerId)
}

export function reconcileNativeHealth(player: Player, reason: string, loadState: () => LifeState): void {
    const id = player.id
    const previous = pending.get(id)
    const work: HealthSync = { player, before: previous?.player === player ? previous.before : undefined }
    pending.set(id, work)
    let state: LifeState | undefined
    let targetMax: number | undefined
    let dispatches = 0
    let waitingForBoost = false
    let lastError: string | undefined

    function report(event: string, effectiveMax: number | undefined, error?: string): void {
        const entry = `[Hearts & Lives] ${JSON.stringify({ event, playerId: id, reason, tick: system.currentTick,
            targetMax, effectiveMax: effectiveMax ?? null, dispatches, error })}`
        if (event === "native_health_unverified") console.warn(entry)
        else console.log(entry)
    }

    // Adding a health group can initialize current HP to the group's value.
    // Undo only an immediate, full refill caused by a cap transition. Never
    // raise current HP, overwrite subsequent damage, or maintain a scripted HP bar.
    function preserveInjury(health: EntityHealthComponent): void {
        const injury = work.before
        if (!injury || health.effectiveMax !== injury.target) return
        work.before = undefined
        if (system.currentTick - injury.tick <= 1 && health.currentValue === injury.target && injury.current < injury.target) {
            if (!health.setCurrentValue(injury.current)) {
                console.warn(`[Hearts & Lives] Engine declined current HP preservation for ${id}`)
            }
        }
    }

    function sample(index: number): void {
        if (pending.get(id) !== work) return
        const elapsed = SAMPLE_TICKS[index]
        const final = index === SAMPLE_TICKS.length - 1
        let measured: number | undefined
        try {
            if (!player.isValid) throw new Error("Player handle unavailable")
            const health = player.getComponent(EntityComponentTypes.Health)
            if (!health || !(health.currentValue > 0)) throw new Error("Waiting for living health component")

            state ??= loadState()
            if (state.awaitingRespawn || isEliminated(state)) {
                cancelHealthSync(id)
                return
            }
            // Older v2 records allow independent balances. A living player
            // with zero saved hearts needs a nonlethal floor until recovery.
            targetMax = Math.max(1, state.hearts)
            measured = health.effectiveMax
            if (player.getEffect("health_boost")) {
                if (!waitingForBoost) report("native_health_deferred_boost", measured)
                waitingForBoost = true
                work.before = undefined
                system.runTimeout(() => sample(0), 20)
                return
            }
            waitingForBoost = false
            preserveInjury(health)
            if (measured === targetMax) {
                // A spawn or a superseded event can still change the maximum
                // after the first sample. Confirm it after the settling window.
                if (elapsed > 0 && elapsed % 20 === 0) {
                    report("native_health_verified", measured)
                    cancelHealthSync(id)
                    return
                }
            } else if (!final && elapsed % 20 === 0 &&
                !(work.before?.target === targetMax && system.currentTick - work.before.tick < 20)) {
                work.before = { current: health.currentValue, target: targetMax, tick: system.currentTick }
                dispatches++
                player.triggerEvent(`waveform_health:cap_${targetMax}`)
                const immediate = player.getComponent(EntityComponentTypes.Health)
                if (immediate) preserveInjury(immediate)
            }
        } catch (error) {
            lastError = String(error)
        }
        if (final) {
            cancelHealthSync(id)
            report("native_health_unverified", measured, lastError)
            if (player.isValid) player.sendMessage("[Hearts & Lives] Native health could not be verified. Rejoin to retry and check the host Content Log.")
        } else {
            system.runTimeout(() => sample(index + 1), SAMPLE_TICKS[index + 1] - elapsed)
        }
    }
    sample(0)
}
