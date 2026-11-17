function signal() {
    const subscribers = []
    return {
        subscribe(handler) { subscribers.push(handler) },
        emit(event) { for (const handler of subscribers) handler(event) },
    }
}

export const EntityComponentTypes = { Health: "health", Inventory: "inventory" }
export const GameMode = { Survival: "survival", Spectator: "spectator", Creative: "creative" }
export const CustomCommandSource = { Entity: "entity", Block: "block" }
export const CustomCommandStatus = { Success: 0, Failure: 1 }
export const CommandPermissionLevel = { Host: 3 }
export const CustomCommandParamType = { PlayerSelector: "player", Enum: "enum", Integer: "integer" }

const scheduled = []
export const system = {
    currentTick: 0,
    beforeEvents: { startup: signal() },
    run(callback) { scheduled.push(callback) },
    advance() {
        this.currentTick += 1
        for (const callback of scheduled.splice(0)) callback()
    },
}

export const saved = new Map()
export const world = {
    afterEvents: { playerSpawn: signal(), entityDie: signal(), worldLoad: signal() },
    players: [],
    getAllPlayers() { return this.players },
    getDynamicProperty(key) { return saved.get(key) },
    setDynamicProperty(key, value) { saved.set(key, value) },
}

export class Player {
    typeId = "minecraft:player"
    isValid = true
    health = 20
    mode = GameMode.Survival
    messages = []
    actionBar = []
    onScreenDisplay = { setActionBar: (message) => this.actionBar.push(message) }
    selectedSlotIndex = 0
    inventory = {
        isValid: true,
        stacks: new Map(),
        getItem(index) { return this.stacks.get(index)?.clone() },
        setItem(index, stack) { this.stacks.set(index, stack?.clone()) },
    }

    constructor(id) {
        this.id = id
        this.name = id
    }

    getGameMode() { return this.mode }
    setGameMode(mode) { this.mode = mode }
    sendMessage(message) { this.messages.push(message) }
    getComponent(type) {
        if (type === EntityComponentTypes.Health) return { currentValue: this.health, effectiveMax: 20 }
        if (type === EntityComponentTypes.Inventory) return { container: this.inventory }
        return undefined
    }
}

export class Stack {
    constructor(typeId, amount) {
        this.typeId = typeId
        this.amount = amount
    }

    clone() { return new Stack(this.typeId, this.amount) }
    isStackableWith(other) { return this.typeId === other.typeId }
}
