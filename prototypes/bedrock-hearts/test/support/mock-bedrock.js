function signal() {
    const subscribers = []
    return {
        subscribe(handler) { subscribers.push(handler) },
        emit(event) { for (const handler of subscribers) handler(event) },
    }
}

export const EntityComponentTypes = { Health: "health", Hunger: "hunger", Inventory: "inventory" }
export const GameMode = { Survival: "survival", Spectator: "spectator", Creative: "creative" }
export const CustomCommandSource = { Entity: "entity", Block: "block" }
export const CustomCommandStatus = { Success: 0, Failure: 1 }
export const CommandPermissionLevel = { Host: 3 }
export const CustomCommandParamType = { PlayerSelector: "player", Enum: "enum", Integer: "integer" }

const scheduled = []
const timeouts = []
const intervals = []
export const system = {
    currentTick: 0,
    beforeEvents: { startup: signal() },
    run(callback) { scheduled.push(callback) },
    runTimeout(callback, delay) { timeouts.push({ callback, due: this.currentTick + delay }) },
    runInterval(callback) { intervals.push(callback) },
    flush() { for (const callback of scheduled.splice(0)) callback() },
    advance() {
        this.currentTick += 1
        this.flush()
        for (const timer of timeouts.filter(({ due }) => due <= this.currentTick)) {
            timeouts.splice(timeouts.indexOf(timer), 1)
            timer.callback()
        }
        for (const callback of intervals) callback()
    },
}

export const saved = new Map()
export const world = {
    beforeEvents: { playerInteractWithBlock: signal() },
    afterEvents: { playerSpawn: signal(), playerLeave: signal(), entityDie: signal(), worldLoad: signal() },
    players: [],
    getAllPlayers() { return this.players },
    getDynamicProperty(key) { return saved.get(key) },
    setDynamicProperty(key, value) { saved.set(key, value) },
}

export class Player {
    typeId = "minecraft:player"
    isValid = true
    health = 20
    healthMax = 20
    hunger = { currentValue: 20, effectiveMax: 20 }
    effects = new Map()
    triggered = []
    mode = GameMode.Survival
    messages = []
    actionBar = []
    onScreenDisplay = { setActionBar: (message) => this.actionBar.push(message) }
    selectedSlotIndex = 0
    dimension = { id: "minecraft:overworld" }
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
    getEffect(name) { return this.effects.get(name) }
    triggerEvent(name) {
        this.triggered.push(name)
        const match = /^waveform_health:cap_([1-9]|1[0-9]|20)$/.exec(name)
        if (!match) throw new Error(`Unknown player event ${name}`)
        this.healthMax = Number(match[1])
        this.health = this.healthMax
    }
    getComponent(type) {
        if (type === EntityComponentTypes.Health) {
            const player = this
            return {
                get currentValue() { return player.health },
                get effectiveMax() {
                    const boost = player.effects.get("health_boost")
                    return player.healthMax + (boost ? 4 * (boost.amplifier + 1) : 0)
                },
                effectiveMin: 0,
                setCurrentValue(value) {
                    if (value < 0 || value > this.effectiveMax) return false
                    player.health = value
                    return true
                },
            }
        }
        if (type === EntityComponentTypes.Hunger) return this.hunger
        if (type === EntityComponentTypes.Inventory) return { container: this.inventory }
        return undefined
    }
}

export class Stack {
    constructor(typeId, amount, metadata = "") {
        this.typeId = typeId
        this.amount = amount
        this.metadata = metadata
    }

    clone() { return new Stack(this.typeId, this.amount, this.metadata) }
    isStackableWith(other) { return this.typeId === other.typeId && this.metadata === other.metadata }
}
