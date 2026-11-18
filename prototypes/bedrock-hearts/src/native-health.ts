import { EntityComponentTypes, system } from "@minecraft/server"
import type { EntityHealthComponent, Player } from "@minecraft/server"
import { isEliminated } from "./lives-state.js"
import type { LifeState } from "./lives-state.js"

// Entity events can apply on the next entity tick. Give each dispatch a full
// second to settle before reissuing it, then take one final read-only sample.
const SETTLE_TICKS = 20
const RETRY_WINDOW = 3 * SETTLE_TICKS
interface HealthSync {
    player: Player
    before?: { current: number; base: number; sampled: number; sent: number }
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
    let expectedMax: number | undefined
    let initialEffectiveMax: number | undefined
    let dispatches = 0
    let lastError: string | undefined
    let injuryError: string | undefined

    function report(event: string, effectiveMax: number | undefined, error?: string): void {
        const entry = `[Hearts & Lives] ${JSON.stringify({ event, playerId: id, reason, tick: system.currentTick,
            targetMax, expectedMax, initialEffectiveMax, effectiveMax: effectiveMax ?? null, dispatches, error })}`
        if (event === "native_health_unverified") console.warn(entry)
        else console.log(entry)
    }

    // Adding a health group can initialize current HP to the group's value.
    // The first observation can include damage after a group refill. Cap the
    // transition at the last pre-swap HP, leaving any lower reading alone.
    function preserveInjury(health: EntityHealthComponent, bonus: number): void {
        const injury = work.before
        if (!injury || health.effectiveMax !== injury.base + bonus) return
        if (health.currentValue > injury.current) {
            if (system.currentTick - injury.sampled > 2) {
                injuryError = "Could not verify current HP across the component change"
            } else {
                health.setCurrentValue(injury.current)
                if (health.currentValue !== injury.current) throw new Error("Could not verify preservation of current HP")
            }
        }
        work.before = undefined
    }

    function sample(elapsed: number): void {
        if (pending.get(id) !== work) return
        const final = elapsed >= RETRY_WINDOW
        let measured: number | undefined
        let matched = false
        try {
            if (!player.isValid) throw new Error("Player handle unavailable")
            state ??= loadState()
            if (state.awaitingRespawn || isEliminated(state)) {
                cancelHealthSync(id)
                return
            }
            // Older v2 records allow independent balances. A living player
            // with zero saved hearts needs a nonlethal floor until recovery.
            targetMax = Math.max(1, state.hearts)
            const health = player.getComponent(EntityComponentTypes.Health)
            if (!health || !(health.currentValue > 0)) throw new Error("Waiting for living health component")
            measured = health.effectiveMax
            initialEffectiveMax ??= measured
            const boost = player.getEffect("health_boost")
            const bonus = boost ? 4 * (boost.amplifier + 1) : 0
            expectedMax = targetMax + bonus
            preserveInjury(health, bonus)
            matched = measured === expectedMax
            const now = system.currentTick
            if (matched) {
                // A spawn or a superseded event can still change the maximum
                // after the first sample. Confirm it after the settling window.
                if (elapsed >= SETTLE_TICKS && !work.before && !injuryError) {
                    report("native_health_verified", measured)
                    cancelHealthSync(id)
                    return
                }
                // An older queued event may have been superseded before it
                // landed. Once the settle window expires the readback wins.
                if (work.before && now - work.before.sent >= SETTLE_TICKS) work.before = undefined
            } else if (work.before?.base === targetMax && now - work.before.sent < SETTLE_TICKS) {
                // Sample the injury immediately before the engine swaps the
                // group, including damage/regeneration since dispatch.
                work.before.current = health.currentValue
                work.before.sampled = now
            } else if (!final) {
                work.before = { current: health.currentValue, base: targetMax, sampled: now, sent: now }
                dispatches++
                player.triggerEvent(`waveform_health:cap_${targetMax}`)
                const immediate = player.getComponent(EntityComponentTypes.Health)
                if (immediate) preserveInjury(immediate, bonus)
            }
        } catch (error) {
            lastError = String(error)
        }
        if (final) {
            cancelHealthSync(id)
            report("native_health_unverified", measured, injuryError ?? lastError)
            try {
                if (player.isValid) player.sendMessage("[Hearts & Lives] Native health could not be verified. Rejoin to retry and check the host Content Log.")
            } catch { /* The player can disconnect during the last readback. */ }
        } else {
            const delay = matched && !work.before ? SETTLE_TICKS - elapsed % SETTLE_TICKS : 1
            system.runTimeout(() => sample(elapsed + delay), delay)
        }
    }
    sample(0)
}
