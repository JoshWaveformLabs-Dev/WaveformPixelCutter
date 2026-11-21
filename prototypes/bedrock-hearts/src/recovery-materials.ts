import type { Container, ItemStack } from "@minecraft/server"
import type { DifficultyPreset } from "./difficulty-settings.js"
import type { RecoveryUnits } from "./lives-state.js"

export interface Ingredient {
    id: string
    label: string
    icon: string
    required: number
}

type Recipe = readonly Ingredient[]
type Prices = Readonly<Record<RecoveryUnits, Recipe>>

const diamond = { id: "minecraft:diamond", label: "Diamond", icon: "diamond" }
const netherite = { id: "minecraft:netherite_ingot", label: "Netherite", icon: "netherite_ingot" }
const sea = { id: "minecraft:heart_of_the_sea", label: "Sea Heart", icon: "heartofthesea_closed" }
const normal: Prices = {
    2: [{ ...diamond, required: 6 }, { ...netherite, required: 2 }, { ...sea, required: 1 }],
    1: [{ ...diamond, required: 3 }, { ...netherite, required: 1 }, { ...sea, required: 1 }],
}

// Only Normal is approved. Replace each provisional entry when its costs are approved.
export const recoveryPrices: Readonly<Record<DifficultyPreset, Prices>> = {
    easy: normal, normal, hard: normal, extreme: normal,
}

type Inventory = Pick<Container, "size" | "getItem" | "setItem">

export interface DebitSlot {
    read(): ItemStack | undefined
    write(stack: ItemStack | undefined): void
    before: ItemStack
    after: ItemStack | undefined
}

export function debitSlot(before: ItemStack, quantity: number, read: DebitSlot["read"], write: DebitSlot["write"]): DebitSlot {
    const after = quantity === before.amount ? undefined : before.clone()
    if (after) after.amount -= quantity
    return { before, after, read, write }
}

export function inventoryCounts(inventory: Inventory): Map<string, number> {
    const counts = new Map<string, number>()
    for (let index = 0; index < inventory.size; index++) {
        const stack = inventory.getItem(index)
        if (stack) counts.set(stack.typeId, (counts.get(stack.typeId) ?? 0) + stack.amount)
    }
    return counts
}

export function materialPayment(inventory: Inventory, recipe: Recipe): DebitSlot[] | "missing_materials" {
    const remaining = new Map(recipe.map(row => [row.id, row.required]))
    const slots: DebitSlot[] = []
    for (let index = 0; index < inventory.size && remaining.size; index++) {
        const stack = inventory.getItem(index)
        if (!stack) continue
        const needed = remaining.get(stack.typeId)
        if (!needed) continue
        const take = Math.min(stack.amount, needed)
        slots.push(debitSlot(stack, take, () => inventory.getItem(index), value => inventory.setItem(index, value)))
        if (take === needed) remaining.delete(stack.typeId)
        else remaining.set(stack.typeId, needed - take)
    }
    return remaining.size ? "missing_materials" : slots
}
