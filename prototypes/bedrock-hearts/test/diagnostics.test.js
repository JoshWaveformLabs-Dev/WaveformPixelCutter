import { deepStrictEqual, equal, throws } from "node:assert/strict"
import { test } from "node:test"
import { formatActionBar, readAttribute, setCurrent } from "../.build/scripts/diagnostics.js"

function attribute(current = 20, min = 0, max = 20) {
    return {
        currentValue: current,
        effectiveMin: min,
        effectiveMax: max,
        setCurrentValue(value) {
            this.currentValue = value
            return true
        },
    }
}

test("read-only telemetry retains full precision and calls no setter", () => {
    const component = attribute(2.3456)
    component.setCurrentValue = () => { throw new Error("unexpected write") }
    deepStrictEqual(readAttribute(() => component), { current: 2.3456, effectiveMax: 20 })
})

test("missing components and lookup or getter errors produce unavailable readings", () => {
    deepStrictEqual(readAttribute(() => undefined), { unavailable: "component missing" })
    deepStrictEqual(readAttribute(() => { throw new Error("invalid player") }), {
        unavailable: "Error: invalid player",
    })
    const component = attribute()
    Object.defineProperty(component, "effectiveMax", { get() { throw new Error("invalid component") } })
    deepStrictEqual(readAttribute(() => component), { unavailable: "Error: invalid component" })
})

test("the action bar distinguishes current and maximum values and displays n/a", () => {
    equal(formatActionBar({
        health: { current: 18, effectiveMax: 20 },
        hunger: { current: 2, effectiveMax: 20 },
        saturation: { unavailable: "component missing" },
        exhaustion: { current: 1.234, effectiveMax: 4 },
        sprinting: false,
    }), "HP 18/20 | Food 2/20 | Sat n/a | Exh 1.23 | Sprint no")
})

test("current writes pass the requested points to only the selected setter", () => {
    const health = attribute()
    const hunger = attribute()
    setCurrent("health", () => health, 19)
    deepStrictEqual(readAttribute(() => health), { current: 19, effectiveMax: 20 })
    deepStrictEqual(readAttribute(() => hunger), { current: 20, effectiveMax: 20 })
    setCurrent("hunger", () => hunger, 0)
    deepStrictEqual(readAttribute(() => health), { current: 19, effectiveMax: 20 })
    deepStrictEqual(readAttribute(() => hunger), { current: 0, effectiveMax: 20 })
})

test("invalid requests respect nonlethal health and live component bounds", () => {
    const health = attribute(12, 0, 14.5)
    const hunger = attribute(6, 2.5, 8)
    for (const value of [0, -1, 15, NaN, 5.5]) {
        throws(() => setCurrent("health", () => health, value), /integer in \[1, 14\]/)
    }
    for (const value of [2, 9]) {
        throws(() => setCurrent("hunger", () => hunger, value), /integer in \[3, 8\]/)
    }
    equal(health.currentValue, 12)
    equal(hunger.currentValue, 6)
})

test("missing components, rejected writes and engine exceptions signal failure", () => {
    throws(() => setCurrent("hunger", () => undefined, 18), /hunger component missing/)
    const health = attribute()
    health.setCurrentValue = () => false
    throws(() => setCurrent("health", () => health, 18), /Engine declined/)
    health.setCurrentValue = () => { throw new Error("engine exception") }
    throws(() => setCurrent("health", () => health, 18), /engine exception/)
})
