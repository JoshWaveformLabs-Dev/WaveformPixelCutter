export const CommandPermissionLevel = { Any: 0 }
export const CustomCommandParamType = { Integer: "Integer" }
export const CustomCommandSource = { Entity: "Entity", Block: "Block" }
export const CustomCommandStatus = { Success: 0, Failure: 1 }
export const EntityComponentTypes = {
    Health: "minecraft:health",
    Hunger: "minecraft:player.hunger",
    Saturation: "minecraft:player.saturation",
    Exhaustion: "minecraft:player.exhaustion",
}

function signal() {
    let callback
    return {
        subscribe(listener) { callback = listener },
        emit(event) { callback(event) },
    }
}

const queue = []
let interval
export const system = {
    beforeEvents: { startup: signal() },
    currentTick: 0,
    run(callback) { this.runTimeout(callback, 1) },
    runTimeout(callback, delay) { queue.push({ callback, tick: this.currentTick + delay }) },
    runInterval(callback) { interval = callback },
    advance(ticks = 1) {
        for (let i = 0; i < ticks; i++) {
            this.currentTick++
            for (const job of queue.filter(({ tick }) => tick === this.currentTick)) {
                queue.splice(queue.indexOf(job), 1)
                job.callback()
            }
            interval?.()
        }
    },
}

export const world = {
    players: [],
    getAllPlayers() { return this.players },
    afterEvents: { playerSpawn: signal(), playerLeave: signal() },
}
