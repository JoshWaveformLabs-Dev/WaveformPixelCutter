import {
    CommandPermissionLevel,
    CustomCommandParamType,
    CustomCommandSource,
    CustomCommandStatus,
    EntityComponentTypes,
    system,
    world,
} from "@minecraft/server"
import type { EntityAttributeComponent, Player } from "@minecraft/server"

const attributeTypes = {
    health: EntityComponentTypes.Health,
    hunger: EntityComponentTypes.Hunger,
    saturation: EntityComponentTypes.Saturation,
    exhaustion: EntityComponentTypes.Exhaustion,
} as const

type Stat = "health" | "hunger"
interface ProbeSettings {
    namespace: string
    stat: Stat
    caps: readonly number[]
}

function read<T>(getValue: () => T): T | { error: string } {
    try {
        return getValue()
    } catch (error) {
        return { error: String(error) }
    }
}

function readAttribute(lookup: () => EntityAttributeComponent | undefined) {
    return read(() => {
        const attribute = lookup()
        if (!attribute) return { unavailable: "component missing" }
        return {
            current: read(() => attribute.currentValue),
            effectiveMax: read(() => attribute.effectiveMax),
            effectiveMin: read(() => attribute.effectiveMin),
            defaultValue: read(() => attribute.defaultValue),
        }
    })
}

function snapshot(player: Player) {
    return {
        player: { id: player.id, name: read(() => player.name) },
        attributes: {
            health: readAttribute(() => player.getComponent(attributeTypes.health)),
            hunger: readAttribute(() => player.getComponent(attributeTypes.hunger)),
            saturation: readAttribute(() => player.getComponent(attributeTypes.saturation)),
            exhaustion: readAttribute(() => player.getComponent(attributeTypes.exhaustion)),
        },
        sprinting: read(() => player.isSprinting),
    }
}

function getWritableAttribute(player: Player, stat: Stat) {
    const attribute = player.getComponent(attributeTypes[stat])
    if (!attribute) throw new Error(`${stat} component missing`)
    return attribute
}

function setCurrent(player: Player, stat: Stat, points: number) {
    const attribute = getWritableAttribute(player, stat)
    const min = Math.ceil(Math.max(attribute.effectiveMin, stat === "health" ? 1 : 0))
    const max = Math.floor(attribute.effectiveMax)
    if (!Number.isInteger(points) || points < min || points > max) {
        throw new Error(`${stat} current value must be an integer in [${min}, ${max}]`)
    }
    if (!attribute.setCurrentValue(points)) {
        throw new Error(`Engine declined the ${stat} current-value write`)
    }
}

export function installProbe({ namespace, stat, caps }: ProbeSettings): void {
    const sprintStates = new Map<string, boolean>()
    let sequence = 0

    function trace(kind: string, fields: Record<string, unknown> = {}) {
        console.warn(`[NativeCaps] ${JSON.stringify({ pack: namespace, tick: system.currentTick, kind, ...fields })}`)
    }

    function observeLater(
        player: Player,
        kind: string,
        fields: Record<string, unknown>,
    ) {
        for (const delay of [1, 20]) {
            system.runTimeout(() => {
                trace(kind, { ...fields, phase: `+${delay}`, ...snapshot(player) })
            }, delay)
        }
    }

    system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
        const register = (
            command: string,
            description: string,
            takesPoints: boolean,
            run: (player: Player, points: number) => string,
        ) => {
            customCommandRegistry.registerCommand({
                name: `${namespace}:${command}`,
                description,
                permissionLevel: CommandPermissionLevel.Any,
                cheatsRequired: false,
                mandatoryParameters: takesPoints
                    ? [{ name: "points", type: CustomCommandParamType.Integer }]
                    : undefined,
            }, (origin, points) => {
                const player = origin.sourceEntity as Player | undefined
                if (origin.sourceType !== CustomCommandSource.Entity || player?.typeId !== "minecraft:player") {
                    return { status: CustomCommandStatus.Failure, message: "Run directly as a player." }
                }
                system.run(() => {
                    const fields = { sequence: ++sequence, command, points }
                    trace("command", { ...fields, phase: "before", ...snapshot(player) })
                    const outcome = read(() => run(player, points))
                    const after = snapshot(player)
                    trace("command", { ...fields, phase: "immediate", outcome, ...after })
                    observeLater(player, "command", { ...fields, outcome })
                    const reading = after.attributes[stat]
                    const values = "current" in reading
                        ? `${stat} current=${JSON.stringify(reading.current)}, max=${JSON.stringify(reading.effectiveMax)}`
                        : JSON.stringify(reading)
                    const message = typeof outcome === "string" ? outcome : outcome.error
                    const chat = read(() => player.sendMessage(`[${namespace}] ${message} | ${values}`))
                    if (chat) trace("chat-error", { ...fields, player: after.player, ...chat })
                })
                return { status: CustomCommandStatus.Success, message: "Probe queued. See private chat and the host Content Log." }
            })
        }

        register("status", "Read native attributes", false, () => "Attributes sampled")
        register("cap", `Request a native ${stat} cap (${caps.join(", ")})`, true, (player, points) => {
            if (!caps.includes(points)) throw new Error(`Choose one of ${caps.join(", ")}`)
            const event = `${namespace}:cap_${points}`
            player.triggerEvent(event)
            return `triggerEvent(${event}) returned without throwing. Check delayed readings.`
        })
        register("reset", "Remove the probe's component groups", false, (player) => {
            const event = `${namespace}:reset`
            player.triggerEvent(event)
            return `triggerEvent(${event}) returned without throwing. Check delayed readings.`
        })
        register("fill", `Reset current ${stat} to its maximum`, false, (player) => {
            getWritableAttribute(player, stat).resetToMaxValue()
            return `Current ${stat} reset requested`
        })
        register("current", `Set current ${stat} for a control test`, true, (player, points) => {
            setCurrent(player, stat, points)
            return `Current ${stat} write accepted`
        })
        if (stat === "hunger") {
            register("health", "Set current health for a regeneration test", true, (player, points) => {
                setCurrent(player, "health", points)
                return "Current health write accepted"
            })
        }
        trace("startup", { stat, caps })
    })

    world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
        sprintStates.delete(player.id)
        const fields = { sequence: ++sequence, initialSpawn }
        trace("spawn", { ...fields, phase: "immediate", ...snapshot(player) })
        observeLater(player, "spawn", fields)
    })

    world.afterEvents.playerLeave.subscribe(({ playerId, playerName }) => {
        sprintStates.delete(playerId)
        trace("leave", { player: { id: playerId, name: playerName } })
    })

    if (stat === "hunger") {
        system.runInterval(() => {
            for (const player of world.getAllPlayers()) {
                const sprinting = read(() => player.isSprinting)
                if (typeof sprinting !== "boolean" || sprintStates.get(player.id) === sprinting) continue
                sprintStates.set(player.id, sprinting)
                trace("sprint", snapshot(player))
            }
        }, 1)
    }
}
