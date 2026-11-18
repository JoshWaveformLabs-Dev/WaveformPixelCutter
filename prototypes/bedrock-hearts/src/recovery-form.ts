import { system } from "@minecraft/server"
import type { Player } from "@minecraft/server"
import { CustomForm, DataDrivenScreenClosedReason, ObservableBoolean, ObservableString } from "@minecraft/server-ui"
import { MAX_UNITS, planRecovery } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import type { DifficultyPreset } from "./difficulty-settings.js"
import { recoveryPrices } from "./recovery-materials.js"

const RESOURCE_PACK = "d28930da-140d-495b-9244-7774e677434c"
const sizes = [2, 1] as const

export interface TableView {
    state: LifeState
    nativeHearts: number
    preset: DifficultyPreset
    cooldownTicks: number
    remainingTicks: number
    counts: Map<string, number>
}

function name(preset: DifficultyPreset): string {
    return preset[0].toUpperCase() + preset.slice(1)
}

function quantity(owned: number, required: number): string {
    if (!required) return "None needed"
    return owned >= required ? `§a${owned} / ${required} · Have§r` :
        `§7${owned} / ${required} · Need ${required - owned}§r`
}

// Read server state again on selection. Observables only provide the preview.
export async function showRecoveryForm(player: Player, initial: TableView,
    refresh: () => TableView | undefined): Promise<RecoveryUnits | undefined> {
    const prices = recoveryPrices[initial.preset]
    const form = new CustomForm(player, "REANIMATION TABLE")
    const summary = new ObservableString("")
    form.label(summary).divider().header("Materials")
    const materials = new Map([...prices[2], ...prices[1]].map(row => [row.id, row]))
    const rows = [...materials.values()].map(ingredient => {
        const text = new ObservableString("")
        form.image(`textures/ui/waveform/${ingredient.icon}.png`, RESOURCE_PACK, { width: 0.07 })
        form.label(text)
        return { ingredient, text }
    })
    form.divider()
    let choice: RecoveryUnits | undefined
    const actions = sizes.map(units => {
        const disabled = new ObservableBoolean(true)
        const status = new ObservableString("")
        const size = units === 2 ? "1" : "½"
        form.button(`RESTORE ${size} HEART`, () => {
            if (choice !== undefined || disabled.getData() || !form.isShowing()) return
            choice = units
            form.close()
        }, { disabled })
        form.label(status)
        return { units, size, disabled, status }
    })
    form.closeButton()

    function render(view: TableView): void {
        const wait = view.remainingTicks > 0 ? `${Math.ceil(view.remainingTicks / 20)}s remaining` : "Ready"
        summary.setData([
            `Lives remaining  ${view.state.lives / 2}`,
            `Current maximum  ${view.nativeHearts} hearts`,
            `Recoverable limit  ${MAX_UNITS / 2} base hearts`,
            `Difficulty  ${name(view.preset)}`,
            `Cooldown  ${wait}  ·  ${view.cooldownTicks / 20}s per recovery`,
        ].join("\n"))
        for (const { ingredient, text } of rows) {
            const owned = view.counts.get(ingredient.id) ?? 0
            const required = (units: RecoveryUnits) => prices[units].find(row => row.id === ingredient.id)?.required ?? 0
            text.setData(`${ingredient.label}\n1 heart   ${quantity(owned, required(2))}\n½ heart   ${quantity(owned, required(1))}`)
        }
        for (const { units, size, disabled, status } of actions) {
            const affordable = prices[units].every(row => (view.counts.get(row.id) ?? 0) >= row.required)
            const plan = planRecovery(view.state, units)
            const blocked = "denial" in plan ? (plan.denial === "over_cap" ? "Capacity limit" : "Unavailable") :
                view.remainingTicks > 0 ? "Cooling down" : undefined
            disabled.setData(!affordable || blocked !== undefined)
            status.setData(`+${size} life and +${size} max heart\n${affordable ? "Materials ready" : "Missing materials"}${blocked ? " · " + blocked : ""}`)
        }
    }

    render(initial)
    let stale = false
    const timer = system.runInterval(() => {
        if (stale || choice !== undefined || !form.isShowing()) return
        try {
            const view = refresh()
            if (view && view.preset === initial.preset && view.cooldownTicks === initial.cooldownTicks) {
                render(view)
                return
            }
            if (player.isValid) player.sendMessage("Table or difficulty changed. Open the table again.")
        } catch (error) {
            console.warn(`[Hearts & Lives] Table refresh failed: ${error}`)
        }
        stale = true
        if (form.isShowing()) form.close()
    }, 20)
    try {
        const reason = await form.show()
        if (reason === DataDrivenScreenClosedReason.UserBusy && player.isValid) {
            player.sendMessage("Close the other screen, then use the Reanimation Table again.")
        }
        if (!stale && reason === DataDrivenScreenClosedReason.ServerClosed) return choice
    } finally {
        system.clearRun(timer)
    }
}
