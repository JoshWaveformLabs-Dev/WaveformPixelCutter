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
import type { Entity, ItemStack } from "@minecraft/server"
import { decodeState, encodeState, initialState, isEliminated } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import { reconcileSpawn, recordDeath, TickGate, writeVerified } from "./lives-store.js"
import type { LifeStore } from "./lives-store.js"
import { recover } from "./recovery.js"
import { readDifficultySettings, readProgressiveHungerEnabled } from "./difficulty-bedrock.js"
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

function reconcilePlayer(player: Player, event: string): void {
    reconcileNativeHealth(player, event, () => {
        const state = reconcileSpawn(store, player.id, true, (saved) => {
            if (isEliminated(saved) && player.getGameMode() !== GameMode.Spectator) {
                player.setGameMode(GameMode.Spectator)
            }
        })
        log(event, player.id, { state })
        player.sendMessage(`${LABEL} ${balance(state)}`)
        return state
    })
}

function resetPlayer(player: Player): void {
    if (!alive(player)) {
        throw new Error("Wait until the target has respawned")
    }
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

function recoverAtTable(player: Player, index: number, item: ItemStack, units: RecoveryUnits): void {
    const inventory = player.getComponent(EntityComponentTypes.Inventory)?.container
    if (!inventory?.isValid) {
        return
    }
    const settings = readDifficultySettings()
    const { recoveryCooldownTicks: cooldownTicks } = settings.presets[settings.activePreset]
    const recoveryTick = getRecoveryTick()
    const result = recover(store, player.id, {
        isSelected: () => player.selectedSlotIndex === index,
        read: () => inventory.getItem(index),
        write: (stack) => inventory.setItem(index, stack),
    }, item, units, { recoveryTick, cooldownTicks, reserve: reserveRecoveryTick })
    if ("denial" in result) {
        if (result.denial === "cooldown") {
            log("recovery_cooldown", player.id, { recoveryTick, remainingTicks: result.remainingTicks })
            const unit = result.remainingTicks === 1 ? "tick" : "ticks"
            player.sendMessage(`${LABEL} Recovery is ready in ${result.remainingTicks} more ${unit}.`)
        } else if (result.denial === "over_cap") {
            player.sendMessage(`${LABEL} This heart would exceed the starting capacity.`)
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
    if (event.cancel || !itemStack || block.typeId !== REANIMATION_TABLE) {
        return
    }
    const units = HEART_UNITS.get(itemStack.typeId)
    if (units === undefined) {
        return
    }

    event.cancel = true
    const id = player.id
    if (!event.isFirstEvent || pendingUses.has(id) || !USES.enter(id, system.currentTick)) {
        return
    }

    const token = Symbol()
    const index = player.selectedSlotIndex
    const item = itemStack.clone()
    const { dimension, location } = block
    // The before event is read-only apart from cancellation. Recheck the request in writable execution.
    system.run(() => {
        if (pendingUses.get(id) !== token) {
            return
        }
        pendingUses.delete(id)
        const ok = guarded("recovery", () => {
            if (!alive(player) || player.getGameMode() === GameMode.Spectator ||
                player.dimension.id !== dimension.id ||
                dimension.getBlock(location)?.typeId !== REANIMATION_TABLE) {
                return
            }
            recoverAtTable(player, index, item, units)
        })
        if (!ok && player.isValid) {
            guarded("recovery feedback", () => player.sendMessage(`${LABEL} Recovery error. Check the host log before retrying.`))
        }
    })
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
    cancelHealthSync(deadEntity.id)
    pendingUses.delete(deadEntity.id)
    const state = recordDeath(store, deadEntity.id)
    if (state !== undefined) {
        log("death", deadEntity.id, { state })
    }
}))

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    pendingUses.delete(playerId)
    cancelHealthSync(playerId)
})

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    pendingUses.delete(player.id)
    guarded("spawn", () => reconcilePlayer(player, "spawn"))
})

world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getAllPlayers()) {
        guarded("world load", () => reconcilePlayer(player, "world_load"))
    }
})
