import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandSource,
    CustomCommandStatus,
    EntityComponentTypes,
    GameMode,
    Player,
    system,
    world,
} from "@minecraft/server"
import type { Entity, ItemStack, Container } from "@minecraft/server"
import { decodeState, encodeState, initialState, isEliminated } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import { reconcileSpawn, recordDeath, TickGate, writeVerified } from "./lives-store.js"
import type { LifeStore } from "./lives-store.js"
import { showRecoveryForm } from "./recovery-form.js"
import { inspectMaterials, inventoryCounts, recoveryPrices } from "./recovery-materials.js"
import { recover, restoreCapacity } from "./recovery.js"
import { readDifficultySettings, readProgressiveHungerEnabled } from "./difficulty-bedrock.js"
import type { DifficultySettings } from "./difficulty-settings.js"
import { intendedHungerTargetUnits } from "./difficulty-settings.js"
import { getRecoveryTick, reserveRecoveryTick } from "./recovery-clock.js"
import { cancelHealthSync, reconcileNativeHealth } from "./native-health.js"

const LABEL = "[Hearts & Lives]"
const REANIMATION_TABLE = "waveform:reanimation_table"
const HEART_UNITS: ReadonlyMap<string, RecoveryUnits> = new Map([
    ["waveform:artificial_heart", 2],
    ["waveform:half_artificial_heart", 1],
])
const RESET_COMMAND = "waveform:reset_lives"
const DEATHS = new TickGate()
const USES = new TickGate()
const pendingUses = new Map<string, symbol>()
type LifeEvent = "spawn" | "death"
const pendingLifeEvents = new Map<string, LifeEvent[]>()

const store: LifeStore = {
    read: (id) => world.getDynamicProperty(`waveform:hearts_lives.${id}`),
    write: (id, value) => world.setDynamicProperty(`waveform:hearts_lives.${id}`, value),
}

function log(event: string, playerId: string, details: object): void {
    console.log(`${LABEL} ${JSON.stringify({ event, playerId, tick: system.currentTick, ...details })}`)
}

function guarded(event: string, operation: () => void): boolean {
    try {
        operation()
        return true
    } catch (error) {
        console.warn(`${LABEL} ${event} failed: ${String(error)}`)
        return false
    }
}

function alive(entity: Entity): boolean {
    return entity.isValid && (entity.getComponent(EntityComponentTypes.Health)?.currentValue ?? 0) > 0
}

function isStaleDeath(entity: Entity): boolean {
    try {
        return alive(entity)
    } catch {
        // The death event itself is authoritative when its dead entity handle is unreadable.
        return false
    }
}

function balance(state: LifeState): string {
    if (isEliminated(state)) return "Eliminated | 0 lives"
    const summary = `${state.lives / 2} lives | saved health target ${Math.max(1, state.hearts) / 2} hearts`
    try {
        const enabled = readProgressiveHungerEnabled()
        return enabled ? `${summary} | hunger target ${intendedHungerTargetUnits(state, enabled) / 2} icons (unenforced)` : summary
    } catch {
        // A malformed optional setting must not block native health or recovery.
        return `${summary} | unreadable hunger setting`
    }
}

function queueLifeEvent(id: string, event: LifeEvent): LifeEvent[] {
    const events = pendingLifeEvents.get(id) ?? []
    if (events.at(-1) !== event) events.push(event)
    pendingLifeEvents.set(id, events)
    return events
}

function enforceElimination(player: Player | undefined, state: LifeState): void {
    if (player && isEliminated(state) && player.getGameMode() !== GameMode.Spectator) {
        player.setGameMode(GameMode.Spectator)
    }
}

// Keep unconfirmed boundaries in order. Both operations are idempotent on
// readback, including a setter that committed before throwing. All other
// progression writes flush these boundaries first.
function flushLifeEvents(id: string, player?: Player): LifeState | undefined {
    const events = pendingLifeEvents.get(id)
    let state: LifeState | undefined
    while (events?.length) {
        const event = events[0]
        state = event === "death" ? recordDeath(store, id) :
            reconcileSpawn(store, id, true, (saved) => enforceElimination(player, saved))
        events.shift()
        if (event === "death" && state) log("death", id, { state })
    }
    pendingLifeEvents.delete(id)
    return state
}

function reconcilePlayer(player: Player, event: string, initialSpawn?: boolean): void {
    // A respawn is a new life even if its native health handle is not readable
    // yet. A world-load roster can also contain someone on the death screen.
    let queued = initialSpawn === false
    if (queued) queueLifeEvent(player.id, "spawn")
    reconcileNativeHealth(player, event, () => {
        if (!queued) {
            const ready = initialSpawn === undefined ? alive(player) :
                player.getComponent(EntityComponentTypes.Health)?.currentValue !== 0
            if (!ready) throw new Error("Waiting for player to respawn")
            queueLifeEvent(player.id, "spawn")
            queued = true
        }
        const state = flushLifeEvents(player.id, player) ?? decodeState(store.read(player.id))
        enforceElimination(player, state)
        log(event, player.id, { state })
        player.sendMessage(`${LABEL} ${balance(state)}`)
        return state
    })
}

function resetPlayer(player: Player): void {
    pendingUses.delete(player.id)
    if (!alive(player)) {
        throw new Error("Wait until the target has respawned")
    }
    flushLifeEvents(player.id, player)
    decodeState(store.read(player.id)) // Leave unreadable or newer records intact.
    const state = initialState()
    writeVerified(store, player.id, encodeState(state))
    if (player.getGameMode() === GameMode.Spectator) {
        player.setGameMode(GameMode.Survival)
    }
    reconcileNativeHealth(player, "reset", () => state)
    log("reset", player.id, { state })
    player.sendMessage(`${LABEL} Host test reset | ${balance(state)}`)
}

function recoverAtTable(player: Player, inventory: Container, settings: DifficultySettings, units: RecoveryUnits,
    legacy?: { index: number; item: ItemStack }): void {
    flushLifeEvents(player.id, player)
    const { recoveryCooldownTicks: cooldownTicks } = settings.presets[settings.activePreset]
    const recoveryTick = getRecoveryTick()
    const timing = { recoveryTick, cooldownTicks, reserve: reserveRecoveryTick }
    const result = legacy ? recover(store, player.id, {
        isSelected: () => player.selectedSlotIndex === legacy.index,
        read: () => inventory.getItem(legacy.index),
        write: stack => inventory.setItem(legacy.index, stack),
    }, legacy.item, units, timing) : restoreCapacity(store, player.id, units, () => {
        const materials = inspectMaterials(inventory, recoveryPrices[settings.activePreset][units])
        return materials.affordable ? materials.slots : "missing_materials"
    }, timing)
    if ("denial" in result) {
        if (result.denial === "cooldown") {
            log("recovery_cooldown", player.id, { recoveryTick, remainingTicks: result.remainingTicks })
            const unit = result.remainingTicks === 1 ? "tick" : "ticks"
            player.sendMessage(`${LABEL} Recovery is ready in ${result.remainingTicks} more ${unit}.`)
        } else if (result.denial === "over_cap") {
            player.sendMessage(`${LABEL} This heart would exceed the starting capacity.`)
        } else if (result.denial === "missing_materials") {
            player.sendMessage(`${LABEL} Missing materials. Open the table to check your inventory.`)
        } else if (result.denial === "stale_item") {
            player.sendMessage(`${LABEL} Hold the matching stackable heart and try again.`)
        }
        return
    }
    reconcileNativeHealth(player, "recovery", () => result.state)
    log("recovery", player.id, { state: result.state, recoveryTick, cooldownTicks })
    player.sendMessage(`${LABEL} Restored ${units / 2} life | ${balance(result.state)}`)
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => guarded("table interaction", () => {
    const { block, itemStack, player } = event
    if (event.cancel || block.typeId !== REANIMATION_TABLE) return
    const legacyUnits = itemStack && HEART_UNITS.get(itemStack.typeId)
    if (itemStack && !legacyUnits) return
    event.cancel = true
    const id = player.id
    if (!event.isFirstEvent || pendingUses.has(id) || !USES.enter(id, system.currentTick)) return

    const token = Symbol()
    const legacy = itemStack && { index: player.selectedSlotIndex, item: itemStack.clone() }
    const { dimension, location } = block
    function withinReach(): boolean {
        if (pendingUses.get(id) !== token || !alive(player) || player.getGameMode() === GameMode.Spectator ||
            player.dimension.id !== dimension.id) return false
        const pos = player.location
        return Math.hypot(pos.x - location.x - 0.5, pos.y - location.y - 0.5, pos.z - location.z - 0.5) <= 6 &&
            dimension.getBlock(location)?.typeId === REANIMATION_TABLE
    }

    function inventory() {
        const container = player.getComponent(EntityComponentTypes.Inventory)?.container
        if (!container?.isValid) throw new Error("Player inventory unavailable")
        return container
    }
    function view() {
        if (!withinReach()) return undefined
        const state = flushLifeEvents(id, player) ?? decodeState(store.read(id))
        const settings = readDifficultySettings()
        const hp = player.getComponent(EntityComponentTypes.Health)?.effectiveMax
        if (hp === undefined) throw new Error("Native maximum health unavailable")
        return { state, nativeHearts: hp / 2, preset: settings.activePreset,
            cooldownTicks: settings.presets[settings.activePreset].recoveryCooldownTicks,
            remainingTicks: Math.max(0, (state.recoveryReadyAt ?? 0) - getRecoveryTick()),
            counts: inventoryCounts(inventory()) }
    }

    async function useTable(): Promise<void> {
        try {
            if (!withinReach()) return
            if (legacy && legacyUnits) {
                recoverAtTable(player, inventory(), readDifficultySettings(), legacyUnits, legacy)
                return
            }
            if (inventory().getItem(player.selectedSlotIndex)) return
            const quote = view()
            if (!quote) return
            const units = await showRecoveryForm(player, quote, view)
            if (!units || pendingUses.get(id) !== token) return
            if (!withinReach()) {
                if (player.isValid) player.sendMessage("Return to the Reanimation Table to restore capacity.")
                return
            }
            const settings = readDifficultySettings()
            if (settings.activePreset !== quote.preset ||
                settings.presets[settings.activePreset].recoveryCooldownTicks !== quote.cooldownTicks) {
                player.sendMessage("Difficulty settings changed. Open the table to review the new costs.")
                return
            }
            recoverAtTable(player, inventory(), settings, units)
        } catch (error) {
            console.warn(`${LABEL} Recovery failed for ${id}: ${error}`)
            if (player.isValid) guarded("recovery feedback", () => player.sendMessage(`${LABEL} Recovery error. Check the host log before retrying.`))
        } finally {
            if (pendingUses.get(id) === token) pendingUses.delete(id)
        }
    }
    system.run(() => { void useTable() })
    pendingUses.set(id, token)
}))

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    guarded("reset registration", () => customCommandRegistry.registerCommand({
        name: RESET_COMMAND,
        description: "Reset one online player's Hearts & Lives state in a test world",
        permissionLevel: CommandPermissionLevel.Host,
        cheatsRequired: true,
        mandatoryParameters: [{ name: "player", type: CustomCommandParamType.PlayerSelector }],
    }, (origin, targets: Player[]) => {
        const host = origin.sourceEntity
        if (origin.sourceType !== CustomCommandSource.Entity ||
            !(host instanceof Player) || targets.length !== 1) {
            return { status: CustomCommandStatus.Failure, message: "Run as the host and select exactly one player." }
        }
        const [player] = targets
        system.run(() => {
            const ok = guarded("reset", () => resetPlayer(player))
            if (!ok) {
                guarded("reset feedback", () => host.sendMessage("Hearts & Lives reset failed. Check the host log."))
            }
        })
        return { status: CustomCommandStatus.Success, message: "Test reset scheduled. Check the host log." }
    }))
})

world.afterEvents.entityDie.subscribe(({ deadEntity }) => guarded("death", () => {
    if (deadEntity.typeId !== "minecraft:player" || isStaleDeath(deadEntity) ||
        !DEATHS.enter(deadEntity.id, system.currentTick)) {
        return
    }
    const id = deadEntity.id
    cancelHealthSync(id)
    pendingUses.delete(id)
    const events = queueLifeEvent(id, "death")
    function commit(attempt: number): void {
        if (pendingLifeEvents.get(id) !== events) return
        if (!guarded(`death save for ${id}`, () => flushLifeEvents(id)) && attempt < 2) {
            system.runTimeout(() => commit(attempt + 1), attempt === 0 ? 1 : 20)
        }
    }
    commit(0)
}))

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    pendingUses.delete(playerId)
    cancelHealthSync(playerId)
})

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    pendingUses.delete(player.id)
    if (!initialSpawn) DEATHS.forget(player.id)
    guarded("spawn", () => reconcilePlayer(player, "spawn", initialSpawn))
})

world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getAllPlayers()) {
        guarded("world load", () => reconcilePlayer(player, "world_load"))
    }
})
