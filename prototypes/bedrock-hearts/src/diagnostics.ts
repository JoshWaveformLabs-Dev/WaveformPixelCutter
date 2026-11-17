import type { EntityAttributeComponent } from "@minecraft/server"

type Attribute = Pick<
    EntityAttributeComponent,
    "currentValue" | "effectiveMax" | "effectiveMin" | "setCurrentValue"
>

type AttributeReading =
    | { current: number; effectiveMax: number }
    | { unavailable: string }

export interface Snapshot {
    health: AttributeReading
    hunger: AttributeReading
    saturation: AttributeReading
    exhaustion: AttributeReading
    sprinting: boolean
}

export type WritableStat = "health" | "hunger"

export function readAttribute(lookup: () => Attribute | undefined): AttributeReading {
    try {
        const component = lookup()
        if (component === undefined) {
            return { unavailable: "component missing" }
        }
        return { current: component.currentValue, effectiveMax: component.effectiveMax }
    } catch (error) {
        return { unavailable: String(error) }
    }
}

export function setCurrent(
    stat: WritableStat,
    lookup: () => Attribute | undefined,
    value: number,
): void {
    const component = lookup()
    if (component === undefined) {
        throw new Error(`${stat} component missing`)
    }

    // Keep the probe nonlethal even when the engine reports a minimum of zero.
    const min = Math.ceil(Math.max(component.effectiveMin, stat === "health" ? 1 : 0))
    const max = Math.floor(component.effectiveMax)
    if (!Number.isInteger(value) || value < min || value > max) {
        throw new Error(`${stat} requires an integer in [${min}, ${max}]`)
    }
    if (!component.setCurrentValue(value)) {
        throw new Error(`Engine declined the current ${stat} write`)
    }
}

function formatAttribute(reading: AttributeReading, showMax: boolean): string {
    if ("unavailable" in reading) {
        return "n/a"
    }
    const current = Number(reading.current.toFixed(2))
    return showMax ? `${current}/${reading.effectiveMax}` : String(current)
}

export function formatActionBar(stats: Snapshot): string {
    return [
        `HP ${formatAttribute(stats.health, true)}`,
        `Food ${formatAttribute(stats.hunger, true)}`,
        `Sat ${formatAttribute(stats.saturation, false)}`,
        `Exh ${formatAttribute(stats.exhaustion, false)}`,
        `Sprint ${stats.sprinting ? "yes" : "no"}`,
    ].join(" | ")
}
