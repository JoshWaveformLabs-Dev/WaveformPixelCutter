import type { ItemStack } from "@minecraft/server"
import { decodeState, encodeState, planRecovery } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import type { LifeStore } from "./lives-store.js"
import { debitSlot } from "./recovery-materials.js"
import type { DebitSlot } from "./recovery-materials.js"

interface HeldSlot {
    isSelected(): boolean
    read(): ItemStack | undefined
    write(stack: ItemStack | undefined): void
}

interface RecoveryTiming {
    recoveryTick: number
    cooldownTicks: number
    reserve: (readyAt: number) => void
}

type Result = { state: LifeState } |
    { denial: "eliminated" | "awaiting_respawn" | "over_cap" | "stale_item" | "missing_materials" } |
    { denial: "cooldown"; remainingTicks: number }

function sameStack(left: ItemStack | undefined, right: ItemStack | undefined): boolean {
    if (!left || !right) return left === right
    return left.typeId === right.typeId && left.amount === right.amount && left.isStackableWith(right)
}

function refund(slots: DebitSlot[]): void {
    const failures: string[] = []
    for (const slot of slots.reverse()) {
        try {
            if (sameStack(slot.read(), slot.before)) continue
            if (!sameStack(slot.read(), slot.after)) throw new Error("rollback could not confirm its debit")
            // As with a debit, a throwing setter may already have committed.
            try { slot.write(slot.before) } finally {
                if (!sameStack(slot.read(), slot.before)) throw new Error("rollback did not restore inventory")
            }
        } catch (error) { failures.push(String(error)) }
    }
    if (failures.length) throw new Error(failures.join(", "))
}

export function restoreCapacity(
    store: LifeStore,
    playerId: string,
    units: RecoveryUnits,
    payment: () => DebitSlot[] | "stale_item" | "missing_materials",
    { recoveryTick, cooldownTicks, reserve }: RecoveryTiming,
): Result {
    const readyAt = recoveryTick + cooldownTicks
    if (!Number.isSafeInteger(recoveryTick) || recoveryTick < 0 ||
        !Number.isSafeInteger(cooldownTicks) || cooldownTicks < 0 || !Number.isSafeInteger(readyAt)) {
        throw new Error("Invalid recovery timing")
    }
    const raw = store.read(playerId)
    const state = decodeState(raw)
    const plan = planRecovery(state, units)
    if ("denial" in plan) return plan
    const remainingTicks = (state.recoveryReadyAt ?? 0) - recoveryTick
    if (remainingTicks > 0) return { denial: "cooldown", remainingTicks }

    const slots = payment()
    if (typeof slots === "string") return { denial: slots }
    if (!slots.length) throw new Error("Empty recovery payment")
    if (cooldownTicks === 0) {
        delete plan.state.recoveryReadyAt
    } else {
        reserve(readyAt)
        plan.state.recoveryReadyAt = readyAt
    }

    const encoded = encodeState(plan.state)
    const attempted: DebitSlot[] = []
    try {
        for (const slot of slots) {
            if (!sameStack(slot.read(), slot.before)) throw new Error("Inventory changed before debit")
            attempted.push(slot)
            slot.write(slot.after)
            if (!sameStack(slot.read(), slot.after)) throw new Error("Could not verify inventory debit")
        }
    } catch (error) {
        refund(attempted)
        throw error
    }
    let saveFailure = "Recovery state write did not persist"
    try {
        store.write(playerId, encoded)
    } catch (error) {
        saveFailure = String(error)
    }

    // Inventory and world properties do not share a transaction. Only refund a confirmed failed grant.
    const persisted = store.read(playerId)
    if (persisted === encoded) return plan
    if (persisted !== raw) throw new Error("Recovery state is indeterminate. Inspect inventory and life record.")
    refund(attempted)
    throw new Error(saveFailure)
}

// Redeem a previously crafted 0.4.2 heart with the same guarded transaction.
export function recover(store: LifeStore, playerId: string, slot: HeldSlot, used: ItemStack,
    units: RecoveryUnits, timing: RecoveryTiming): Result {
    return restoreCapacity(store, playerId, units, () => {
        const held = slot.read()
        if (!held || !sameStack(held, used) || !slot.isSelected()) return "stale_item"
        return [debitSlot(held, 1, slot.read, slot.write)]
    }, timing)
}
