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
import type { Entity } from "@minecraft/server"
import { encodeState, initialState, isEliminated } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import { reconcileSpawn, recordDeath, TickGate } from "./lives-store.js"
import type { LifeStore } from "./lives-store.js"
import { recover } from "./recovery.js"

const LABEL = "[Hearts & Lives]"
const RECOVERY_COMPONENT = "waveform:recover_capacity"
const RESET_COMMAND = "waveform:reset_lives"
const DEATHS = new TickGate()
const USES = new TickGate()

const store: LifeStore = {
    read: (id) => world.getDynamicProperty(`waveform:hearts_lives.${id}`),
    write: (id, value) => world.setDynamicProperty(`waveform:hearts_lives.${id}`, value),
}

function log(event: string, playerId: string, state: LifeState): void {
    console.log(`${LABEL} ${JSON.stringify({ event, playerId, tick: system.currentTick, state })}`)
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
    return `${state.lives / 2} lives | logical capacity ${state.hearts / 2} hearts, ${state.hunger / 2} hunger icons`
}

function reconcilePlayer(player: Player, event: string): boolean {
    if (!alive(player)) {
        return false
    }
    const state = reconcileSpawn(store, player.id, true, (saved) => {
        if (isEliminated(saved) && player.getGameMode() !== GameMode.Spectator) {
            player.setGameMode(GameMode.Spectator)
        }
    })
    log(event, player.id, state)
    player.sendMessage(`${LABEL} ${isEliminated(state) ? "Eliminated | " : ""}${balance(state)}`)
    return true
}

function resetPlayer(player: Player): void {
    if (!alive(player)) {
        throw new Error("Wait until the target has respawned")
    }
    const state = initialState()
    const encoded = encodeState(state)
    store.write(player.id, encoded)
    if (store.read(player.id) !== encoded) {
        throw new Error("Could not verify the reset. Check the saved life record before retrying.")
    }
    if (player.getGameMode() === GameMode.Spectator) {
        player.setGameMode(GameMode.Survival)
    }
    log("reset", player.id, state)
    player.sendMessage(`${LABEL} Host test reset | ${balance(state)}`)
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry, customCommandRegistry }) => {
    guarded("recovery registration", () => itemComponentRegistry.registerCustomComponent(RECOVERY_COMPONENT, {
        onUse({ source: player, itemStack }) {
            const ok = guarded("recovery", () => {
                let units: RecoveryUnits
                switch (itemStack?.typeId) {
                    case "waveform:artificial_heart":
                        units = 2
                        break
                    case "waveform:half_artificial_heart":
                        units = 1
                        break
                    default:
                        return
                }
                if (!alive(player) || player.getGameMode() === GameMode.Spectator ||
                    !USES.enter(player.id, system.currentTick)) {
                    return
                }
                const index = player.selectedSlotIndex
                const inventory = player.getComponent(EntityComponentTypes.Inventory)?.container
                if (!inventory?.isValid) {
                    return
                }
                const result = recover(store, player.id, {
                    isSelected: () => player.selectedSlotIndex === index,
                    read: () => inventory.getItem(index),
                    write: (stack) => inventory.setItem(index, stack),
                }, itemStack, units)
                if ("denial" in result) {
                    if (result.denial === "over_cap") {
                        player.sendMessage(`${LABEL} This heart would exceed the starting capacity.`)
                    } else if (result.denial === "stale_item") {
                        player.sendMessage(`${LABEL} Hold the matching stackable heart and try again.`)
                    }
                    return
                }
                log("recovery", player.id, result.state)
                player.sendMessage(`${LABEL} Restored ${units / 2} | ${balance(result.state)}`)
            })
            if (!ok) {
                guarded("recovery feedback", () => player.sendMessage(`${LABEL} Recovery error. Check the host log before retrying.`))
            }
        },
    }))

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
    const state = recordDeath(store, deadEntity.id)
    if (state !== undefined) {
        log("death", deadEntity.id, state)
    }
}))

world.afterEvents.playerSpawn.subscribe(({ player }) => {
    let reconciled = false
    guarded("spawn", () => { reconciled = reconcilePlayer(player, "spawn") })
    if (!reconciled) {
        system.run(() => guarded("spawn retry", () => reconcilePlayer(player, "spawn_retry")))
    }
})

world.afterEvents.worldLoad.subscribe(() => {
    for (const player of world.getAllPlayers()) {
        guarded("world load", () => reconcilePlayer(player, "world_load"))
    }
})
