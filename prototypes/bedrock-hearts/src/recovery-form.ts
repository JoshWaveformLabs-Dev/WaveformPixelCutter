import { system } from "@minecraft/server"
import type { Player } from "@minecraft/server"
import { CustomForm, DataDrivenScreenClosedReason, ObservableBoolean, ObservableNumber, ObservableString } from "@minecraft/server-ui"
import { MAX_UNITS, planRecovery } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import type { DifficultyPreset } from "./difficulty-settings.js"
import { recoveryPrices } from "./recovery-materials.js"

const RESOURCE_PACK = "d28930da-140d-495b-9244-7774e677434c"
const sizes = [2, 1] as const
const fullMessage = "ALL HEARTS RESTORED!"

export interface TableView {
    state: LifeState
    preset: DifficultyPreset
    cooldownTicks: number
    remainingTicks: number
    counts: Map<string, number>
}

function heartCount(units: number): string {
    return `§c♥§r ${units / 2} / ${MAX_UNITS / 2} Hearts`
}

export function roomMessage(state: LifeState): string {
    if (state.hearts === MAX_UNITS) return fullMessage
    return "state" in planRecovery(state, 1) ? "Only half a heart will fit." : "No hearts to restore right now."
}

export function waitMessage(ticks: number): string {
    const seconds = Math.ceil(ticks / 20)
    return `Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`
}

export async function showRecoveryForm(player: Player, initial: TableView,
    refresh: () => TableView | undefined, restore: (units: RecoveryUnits) => LifeState | undefined): Promise<void> {
    const form = new CustomForm(player, "REANIMATION TABLE")
    const hearts = new ObservableString("")
    const hint = new ObservableString("")
    const showHint = new ObservableBoolean(false)
    const showPicker = new ObservableBoolean(false)
    const showTotal = new ObservableBoolean(true)
    const size = new ObservableNumber("denial" in planRecovery(initial.state, 2) ? 1 : 0, { clientWritable: true })
    // Use the dropdown caption for the total while choosing, and the header on the receipt.
    form.header(hearts, { visible: showTotal })
    form.dropdown(hearts, size, [{ label: "Full Heart", value: 0 }, { label: "Half Heart", value: 1 }],
        { visible: showPicker, tooltip: "Choose heart size" })
    form.label(hint, { visible: showHint })

    let view = initial
    let finished = false
    let closeReceiptAt: number | undefined
    let submitError: unknown
    const offers = sizes.map((units, index) => {
        const visible = new ObservableBoolean(false)
        const disabled = new ObservableBoolean(true)
        const rows = recoveryPrices[initial.preset][units].map(ingredient => {
            const text = new ObservableString("")
            // An inert native button is the stable control that puts an icon and text on one line.
            form.button(text, () => {}, { visible, disabled: true, imageDetails: {
                imageSrc: `textures/ui/waveform/${ingredient.icon}.png`, imagePackId: RESOURCE_PACK,
            } })
            return { ingredient, text }
        })
        // Each price has its own button identity. A late click for a hidden price cannot buy the new one.
        form.button("RESTORE HEART", () => {
            if (finished || !form.isShowing() || size.getData() !== index || !visible.getData() || disabled.getData()) return
            finished = true
            try {
                const state = restore(units)
                if (state) {
                    render({ ...view, state }, units === 2 ? "Heart restored!" : "Half heart restored!")
                    closeReceiptAt = system.currentTick + 40
                    return
                }
            } catch (error) {
                submitError = error
            }
            form.close()
        }, { visible, disabled })
        return { units, visible, disabled, rows }
    })
    form.closeButton()

    function render(current: TableView, confirmation?: string): void {
        hearts.setData(heartCount(current.state.hearts))
        const smallest = planRecovery(current.state, 1)
        const canChoose = !confirmation && "state" in smallest
        showTotal.setData(!canChoose)
        showPicker.setData(canChoose)
        const offer = canChoose ? offers[size.getData()] : undefined
        for (const option of offers) {
            option.visible.setData(option === offer)
            if (option !== offer) option.disabled.setData(true)
        }

        let message = ""
        if (offer) {
            let enough = true
            for (const { ingredient, text } of offer.rows) {
                const have = current.counts.get(ingredient.id) ?? 0
                const ready = have >= ingredient.required
                if (!ready) enough = false
                const covered = Math.min(have, ingredient.required)
                const status = ready ? "Ready" : `Need ${ingredient.required - have}`
                // Keep all spaces inside a single colour run so DDUI preserves the separators.
                text.setData(`${ready ? "§a" : "§c"}${ingredient.label} ${covered}/${ingredient.required} - ${status}§r`)
            }
            if ("denial" in planRecovery(current.state, offer.units)) message = roomMessage(current.state)
            else if (current.remainingTicks > 0) message = waitMessage(current.remainingTicks)
            offer.disabled.setData(!enough || message !== "")
        } else if (current.state.hearts === MAX_UNITS) {
            message = fullMessage
        } else if (confirmation) {
            message = confirmation
        } else if ("denial" in smallest) {
            message = roomMessage(current.state)
        } else {
            message = "Choose a heart size."
        }
        hint.setData(message)
        showHint.setData(message !== "")
    }

    render(initial)
    const onSize = size.subscribe(() => {
        if (!finished && form.isShowing()) render(view)
    })
    const timer = system.runInterval(() => {
        if (!form.isShowing()) return
        if (finished) {
            if (closeReceiptAt !== undefined && system.currentTick >= closeReceiptAt) form.close()
            return
        }
        try {
            const next = refresh()
            if (next && next.preset === initial.preset && next.cooldownTicks === initial.cooldownTicks) {
                view = next
                render(view)
                return
            }
        } catch (error) {
            console.warn(`[Hearts & Lives] Table refresh failed: ${error}`)
        }
        finished = true
        if (player.isValid) player.sendMessage("Open the Reanimation Table again.")
        form.close()
    }, 20)
    try {
        const reason = await form.show()
        if (submitError !== undefined) throw submitError
        if (reason === DataDrivenScreenClosedReason.UserBusy && player.isValid) {
            player.sendMessage("Close the other screen, then use the Reanimation Table again.")
        }
    } finally {
        finished = true
        system.clearRun(timer)
        size.unsubscribe(onSize)
    }
}
