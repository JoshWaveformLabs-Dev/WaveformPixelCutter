import "./lives-bedrock.js"

import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandSource,
    CustomCommandStatus,
    EntityComponentTypes,
    Player,
    system,
    world,
} from "@minecraft/server"
import type { CustomCommandOrigin, CustomCommandResult } from "@minecraft/server"
import { formatActionBar, readAttribute, setCurrent } from "./diagnostics.js"
import type { Snapshot, WritableStat } from "./diagnostics.js"

const LABEL = "[Hearts Probe]"
const COMPONENT = "waveform:report_attributes"
const COMMAND = "waveform:set_current"
const STAT_ENUM = "waveform:probe_stat"

const writableComponents = {
    health: EntityComponentTypes.Health,
    hunger: EntityComponentTypes.Hunger,
} as const

let sequence = 0

function sample(player: Player): Snapshot {
    return {
        health: readAttribute(() => player.getComponent(EntityComponentTypes.Health)),
        hunger: readAttribute(() => player.getComponent(EntityComponentTypes.Hunger)),
        saturation: readAttribute(() => player.getComponent(EntityComponentTypes.Saturation)),
        exhaustion: readAttribute(() => player.getComponent(EntityComponentTypes.Exhaustion)),
        sprinting: player.isSprinting,
    }
}

function log(event: string, details: object = {}): void {
    console.log(`${LABEL} ${JSON.stringify({ event, tick: system.currentTick, sequence: ++sequence, ...details })}`)
}

function playerIdentity(player: Player) {
    return { id: player.id, name: player.name }
}

function safely(event: string, callback: () => void): void {
    try {
        callback()
    } catch (error) {
        console.warn(`${LABEL} ${event} failed: ${String(error)}`)
    }
}

function probeCurrent(player: Player, stat: WritableStat, requested: number): void {
    safely("set_current", () => {
        if (!player.isValid) {
            log("set_current_aborted", { playerId: player.id, stat, requested, reason: "player left or became invalid" })
            return
        }
        const identity = playerIdentity(player)
        const before = sample(player)
        let errorMessage: string | undefined
        try {
            setCurrent(stat, () => player.getComponent(writableComponents[stat]), requested)
        } catch (error) {
            errorMessage = String(error)
        }
        const after = sample(player)
        log("set_current", { player: identity, stat, requested, before, after, error: errorMessage })
        if (errorMessage !== undefined) {
            player.sendMessage(`Hearts Probe current write failed: ${errorMessage}`)
        }
        player.onScreenDisplay.setActionBar(formatActionBar(after))
    })
}

function scheduleCurrentProbe(origin: CustomCommandOrigin, stat: unknown, value: unknown): CustomCommandResult {
    try {
        const player = origin.sourceEntity
        if (origin.sourceType !== CustomCommandSource.Entity || !(player instanceof Player)) {
            return { status: CustomCommandStatus.Failure, message: "Run this command as the host player." }
        }
        if ((stat !== "health" && stat !== "hunger") || typeof value !== "number" || !Number.isInteger(value)) {
            return { status: CustomCommandStatus.Failure, message: "Choose health or hunger and a whole number." }
        }

        // Custom command callbacks run in a restricted context. Sample and write on the next system run.
        system.run(() => probeCurrent(player, stat, value))
        return { status: CustomCommandStatus.Success, message: "Current-value probe scheduled. Check the action bar and content log." }
    } catch (error) {
        console.warn(`${LABEL} ${COMMAND} scheduling failed: ${String(error)}`)
        return { status: CustomCommandStatus.Failure, message: "Could not schedule the current-value probe." }
    }
}

system.beforeEvents.startup.subscribe(({ itemComponentRegistry, customCommandRegistry }) => {
    safely("item registration", () => {
        itemComponentRegistry.registerCustomComponent(COMPONENT, {
            onUse({ source, itemStack }) {
                safely("item_use", () => {
                    const stats = sample(source)
                    log("item_use", {
                        player: playerIdentity(source),
                        item: itemStack?.typeId,
                        stats,
                    })
                    source.onScreenDisplay.setActionBar(formatActionBar(stats))
                })
            },
        })
    })

    safely("command registration", () => {
        customCommandRegistry.registerEnum(STAT_ENUM, Object.keys(writableComponents))
        customCommandRegistry.registerCommand(
            {
                name: COMMAND,
                description: "Probe a current health or hunger value for the host",
                permissionLevel: CommandPermissionLevel.Host,
                cheatsRequired: true,
                mandatoryParameters: [
                    { name: STAT_ENUM, type: CustomCommandParamType.Enum },
                    { name: "points", type: CustomCommandParamType.Integer },
                ],
            },
            scheduleCurrentProbe,
        )
    })
})

world.afterEvents.worldLoad.subscribe(() => safely("world_load", () => log("world_load")))
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    safely("player_spawn", () => {
        log("player_spawn", { player: playerIdentity(player), initialSpawn, stats: sample(player) })
    })
})
