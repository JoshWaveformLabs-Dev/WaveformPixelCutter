import type { ItemStack } from "@minecraft/server"
import { decodeState, encodeState, planRecovery } from "./lives-state.js"
import type { LifeState, RecoveryUnits } from "./lives-state.js"
import type { LifeStore } from "./lives-store.js"

export interface HeldSlot {
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
    { denial: "eliminated" | "awaiting_respawn" | "over_cap" | "stale_item" } |
    { denial: "cooldown"; remainingTicks: number }

function sameStack(left: ItemStack | undefined, right: ItemStack | undefined): boolean {
    if (left === undefined || right === undefined) {
        return left === right
    }
    return left.typeId === right.typeId && left.amount === right.amount && left.isStackableWith(right)
}

function restoreDebit(slot: HeldSlot, before: ItemStack, debit: ItemStack | undefined): void {
    const current = slot.read()
    if (!sameStack(current, debit)) {
        throw new Error("Recovery rollback could not confirm its debit. Inspect the held slot and life record.")
    }
    slot.write(before)
    if (!sameStack(slot.read(), before)) {
        throw new Error("Recovery rollback could not restore the original held stack")
    }
}

export function recover(
    store: LifeStore,
    playerId: string,
    slot: HeldSlot,
    used: ItemStack,
    units: RecoveryUnits,
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
    if ("denial" in plan) {
        return plan
    }

    const remainingTicks = (state.recoveryReadyAt ?? 0) - recoveryTick
    if (remainingTicks > 0) {
        return { denial: "cooldown", remainingTicks }
    }

    const held = slot.read()
    if (held === undefined || !sameStack(held, used) || !slot.isSelected()) {
        return { denial: "stale_item" }
    }
    // Store the issued expiry with the grant so a retry cannot observe one without the other.
    if (cooldownTicks === 0) {
        delete plan.state.recoveryReadyAt
    } else {
        reserve(readyAt)
        plan.state.recoveryReadyAt = readyAt
    }
    const before = held.clone()
    const debit = held.amount === 1 ? undefined : held.clone()
    if (debit !== undefined) {
        debit.amount -= 1
    }

    try {
        slot.write(debit)
    } catch (error) {
        // A throwing setter has no documented atomicity guarantee.
        if (!sameStack(slot.read(), before)) {
            restoreDebit(slot, before, debit)
        }
        throw error
    }
    if (!sameStack(slot.read(), debit)) {
        throw new Error("Recovery could not verify the inventory debit")
    }

    const encoded = encodeState(plan.state)
    let saveFailure = "Recovery state write did not persist"
    try {
        store.write(playerId, encoded)
    } catch (error) {
        saveFailure = String(error)
    }

    // Write and readback are synchronous, but the world and inventory have no shared save transaction.
    const persisted = store.read(playerId)
    if (persisted === encoded) {
        return plan
    }
    if (persisted !== raw) {
        throw new Error("Recovery state is indeterminate. Inspect the held slot and life record.")
    }
    restoreDebit(slot, before, debit)
    throw new Error(saveFailure)
}
