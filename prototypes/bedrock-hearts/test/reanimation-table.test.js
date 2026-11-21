import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import { setImmediate } from "node:timers/promises"
import { beforeEach, test } from "node:test"
import { GameMode, Player, Stack, saved, system, world } from "./support/mock-bedrock.js"
import { CustomForm } from "./support/mock-ui.js"

const urls = new Map([
    ["@minecraft/server", new URL("./support/mock-bedrock.js", import.meta.url).href],
    ["@minecraft/server-ui", new URL("./support/mock-ui.js", import.meta.url).href],
])
const hook = registerHooks({ resolve(specifier, context, next) {
    return urls.has(specifier) ? { shortCircuit: true, url: urls.get(specifier) } : next(specifier, context)
} })
await import("../.build/scripts/main.js")
const { readDifficultySettings, DIFFICULTY_SETTINGS_KEY } = await import("../.build/scripts/difficulty-bedrock.js")
hook.deregister()
beforeEach(() => { saved.clear(); world.afterEvents.worldLoad.emit() })

const readState = p => JSON.parse(saved.get("waveform:hearts_lives." + p.id))
const settle = () => setImmediate()
const value = binding => binding?.getData?.() ?? binding
const visible = form => form.controls.filter(control => value(control.visible) !== false)
const text = form => visible(form).filter(control => control.text).map(control => value(control.text))
const picker = form => visible(form).find(control => control.type === "dropdown")
const restore = form => visible(form).find(control => control.text === "RESTORE HEART")
const rows = form => visible(form).filter(control => control.imageDetails)
function choose(form, label) {
    const control = picker(form)
    control.value.setData(control.items.find(item => item.label === label).value)
}
function advance(ticks) {
    for (let i = 0; i < ticks; i++) system.advance()
}
function fixture(id, units = 15) {
    const player = new Player(id)
    saved.set("waveform:hearts_lives." + id, JSON.stringify({ version: 1, units }))
    world.afterEvents.playerSpawn.emit({ player, initialSpawn: true })
    player.health = 4
    const block = {
        typeId: "waveform:reanimation_table", location: { x: 3, y: 70, z: 5 },
        dimension: { id: player.dimension.id, getBlock: () => block },
    }
    const items = [[1, "diamond", 2], [35, "diamond", 5], [11, "netherite_ingot", 2],
        [12, "heart_of_the_sea", 1], [17, "dirt", 64]]
    for (const [slot, type, amount] of items) player.inventory.setItem(slot, new Stack("minecraft:" + type, amount))
    const use = (isFirstEvent = true) => {
        const event = { player, block, isFirstEvent, itemStack: player.inventory.getItem(player.selectedSlotIndex), cancel: false }
        world.beforeEvents.playerInteractWithBlock.emit(event)
        return event
    }
    const open = () => { assert.equal(use().cancel, true); system.advance(); return player.forms.at(-1) }
    const amounts = () => items.map(([slot]) => player.inventory.getItem(slot)?.amount ?? 0)
    return { player, block, use, open, amounts }
}

test("normal use opens the placed table once after the before-event with an occupied or empty hand", async () => {
    for (const held of ["waveform:reanimation_table", "minecraft:diamond", "minecraft:iron_pickaxe", undefined]) {
        const f = fixture(`open-${held}`, held === "waveform:reanimation_table" ? 20 : 16)
        f.player.selectedSlotIndex = 4
        if (held) f.player.inventory.setItem(4, new Stack(held, 1))
        const state = readState(f.player)
        const stock = f.amounts()
        assert.equal(f.use().cancel, true, String(held))
        assert.equal(f.use(false).cancel, true)
        assert.equal(f.player.forms?.length ?? 0, 0, "the before-event must defer UI")
        system.advance()
        assert.equal(f.player.forms?.length, 1, String(held))
        const form = f.player.forms[0]
        assert.equal(form.player, f.player)
        assert.equal(form.title, "REANIMATION TABLE")
        assert.equal(form.isShowing(), true)
        assert.ok(text(form).includes(state.hearts === 20 ? "ALL HEARTS RESTORED!" : "RESTORE HEART"))
        assert.equal(f.player.inventory.getItem(4)?.typeId, held)
        assert.deepEqual(f.amounts(), stock)
        assert.deepEqual(readState(f.player), state)
        form.dismiss()
        await settle()
    }
})

test("sneak-use with a held block leaves placement to Minecraft and standing use opens the table", async () => {
    const f = fixture("place-again")
    f.player.inventory.setItem(0, new Stack("waveform:reanimation_table", 3))
    f.player.isSneaking = true
    assert.equal(f.use().cancel, false)
    system.advance()
    assert.equal(f.player.forms?.length ?? 0, 0)
    f.player.isSneaking = false
    const form = f.open()
    assert.equal(form.isShowing(), true)
    assert.equal(f.player.inventory.getItem(0).amount, 3)
    form.dismiss()
    await settle()
})

test("a hotbar change before the deferred open neither cancels the preview nor redeems a held heart", async () => {
    const f = fixture("switch-before-open")
    assert.equal(f.use().cancel, true)
    f.player.inventory.setItem(0, new Stack("waveform:artificial_heart", 2))
    system.advance()
    const form = f.player.forms?.[0]
    assert.ok(form?.isShowing())
    assert.equal(f.player.inventory.getItem(0).amount, 2)
    assert.equal(readState(f.player).lives, 15)
    form.dismiss()
    await settle()
})

test("a form construction error or a rejected show reports the failure and releases the player to open again", async t => {
    const warnings = []
    t.mock.method(console, "warn", message => warnings.push(message))
    for (const method of ["dropdown", "show"]) {
        const f = fixture(`open-error-${method}`)
        const failure = new Error(`UI failure at ${method}`)
        const fault = t.mock.method(CustomForm.prototype, method, () => {
            if (method === "show") return Promise.reject(failure)
            throw failure
        })
        const stock = f.amounts()
        assert.equal(f.use().cancel, true)
        system.advance()
        await settle()
        assert.equal(f.player.forms?.length ?? 0, 0)
        assert.match(f.player.messages.at(-1), /table couldn't open/i)
        assert.ok(warnings.some(message => message.includes("table_open_failed") && message.includes(failure.message)))
        assert.deepEqual(f.amounts(), stock)
        assert.equal(readState(f.player).lives, 15)
        fault.mock.restore()
        const next = f.open()
        assert.ok(next.isShowing())
        next.dismiss()
        await settle()
    }
})

test("each preset shows one selected recipe with item textures, have/need counts and one restore action", async () => {
    for (const preset of ["normal", "easy", "hard", "extreme"]) {
        const settings = readDifficultySettings()
        saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify({ ...settings, activePreset: preset }))
        const { player, open, amounts } = fixture(preset)
        player.inventory.setItem(35, new Stack("minecraft:diamond", 2))
        const form = open()
        assert.equal(form.title, "REANIMATION TABLE")
        assert.deepEqual(picker(form).items.map(item => item.label), ["Full Heart", "Half Heart"])
        assert.equal(picker(form).value.getData(), 0)
        assert.deepEqual(text(form), ["§c♥§r 7.5 / 10 Hearts", "§cDiamond 4/6 - Need 2§r",
            "§aNetherite 2/2 - Ready§r", "§aSea Heart 1/1 - Ready§r", "RESTORE HEART"])
        const icons = ["diamond", "netherite_ingot", "heartofthesea_closed"].map(icon => ({
            imageSrc: `textures/ui/waveform/${icon}.png`, imagePackId: "d28930da-140d-495b-9244-7774e677434c",
        }))
        assert.deepEqual(rows(form).map(row => row.imageDetails), icons)
        assert.ok(rows(form).every(row => row.disabled === true))
        assert.equal(restore(form).disabled.getData(), true)
        restore(form).click()
        assert.equal(form.isShowing(), true)
        choose(form, "Half Heart")
        assert.deepEqual(rows(form).map(row => value(row.text)), [
            "§aDiamond 3/3 - Ready§r", "§aNetherite 1/1 - Ready§r", "§aSea Heart 1/1 - Ready§r"])
        assert.deepEqual(rows(form).map(row => row.imageDetails), icons)
        for (const row of rows(form)) row.click()
        assert.deepEqual(amounts(), [2, 2, 2, 1, 64])
        assert.equal(restore(form).disabled.getData(), false)
        restore(form).click()
        await settle()
        assert.deepEqual(text(form), ["§c♥§r 8 / 10 Hearts", "Half heart restored!"])
        assert.deepEqual(amounts(), [0, 1, 1, 0, 64])
        assert.deepEqual([readState(player).lives, player.healthMax, player.health], [16, 16, 4])
        form.dismiss()
        await settle()
    }
})

test("every ingredient caption fits the short printable-ASCII format from empty inventory through surplus", async () => {
    const f = fixture("readable-rows")
    const ingredients = [
        { slot: 1, id: "diamond", label: "Diamond" },
        { slot: 11, id: "netherite_ingot", label: "Netherite" },
        { slot: 12, id: "heart_of_the_sea", label: "Sea Heart" },
    ]
    const form = f.open()
    f.player.inventory.setItem(35, undefined)
    for (const [size, costs] of [["Full Heart", [6, 2, 1]], ["Half Heart", [3, 1, 1]]]) {
        choose(form, size)
        for (const have of [0, 1, 2, 3, 4, 5, 6, 64, 128]) {
            for (const [index, { slot, id }] of ingredients.entries()) {
                const stack = count => count ? new Stack("minecraft:" + id, count) : undefined
                f.player.inventory.setItem(slot, stack(Math.min(have, 64)))
                f.player.inventory.setItem(20 + index, stack(Math.max(0, have - 64)))
            }
            advance(20)
            const captions = rows(form).map(row => value(row.text))
            assert.equal(captions.length, ingredients.length)
            for (const [index, caption] of captions.entries()) {
                const cost = costs[index]
                const enough = have >= cost
                const status = enough ? "Ready" : `Need ${cost - have}`
                assert.match(caption, /^§[ac][ -~]+§r$/)
                const printed = caption.slice(2, -2)
                assert.equal(caption.slice(0, 2), enough ? "§a" : "§c")
                assert.equal(printed, `${ingredients[index].label} ${Math.min(have, cost)}/${cost} - ${status}`)
                assert.ok(printed.length <= 22, printed)
            }
        }
    }
    form.dismiss()
    await settle()
})

test("the recipe uses the picker caption for the heart total and adds a hint only when needed", async () => {
    const f = fixture("compact-controls", 19)
    const form = f.open()
    const controls = () => visible(form).map(control => control.type)
    assert.deepEqual(controls(), ["dropdown", "button", "button", "button", "button", "close"])
    assert.equal(value(picker(form).text), "§c♥§r 9.5 / 10 Hearts")
    assert.equal(picker(form).tooltip, "Choose heart size")
    choose(form, "Full Heart")
    assert.deepEqual(controls(), ["dropdown", "label", "button", "button", "button", "button", "close"])
    assert.equal(text(form)[1], "Only half a heart will fit.")
    choose(form, "Half Heart")
    restore(form).click()
    assert.deepEqual(controls(), ["header", "label", "close"])
    assert.deepEqual(text(form), ["§c♥§r 10 / 10 Hearts", "ALL HEARTS RESTORED!"])
    form.dismiss()
    await settle()
})

test("two concurrent users choose independently and held input and duplicate clicks charge once", async () => {
    const a = fixture("host"), b = fixture("guest")
    a.use(); a.use(); b.use()
    system.advance()
    a.use(false); a.use(); b.use()
    system.advance()
    assert.equal(a.player.forms.length, 1)
    assert.equal(b.player.forms.length, 1)
    const host = a.player.forms[0], guest = b.player.forms[0]
    const hostFull = restore(host), guestFull = restore(guest)
    choose(guest, "Half Heart")
    guestFull.click() // late input for the previously displayed price
    assert.deepEqual(b.amounts(), [2, 5, 2, 1, 64])
    assert.equal(picker(host).value.getData(), 0)
    hostFull.click()
    hostFull.click()
    restore(guest).click()
    a.use(false); b.use()
    system.advance()
    await settle()
    assert.deepEqual(a.amounts(), [0, 1, 0, 0, 64])
    assert.deepEqual(b.amounts(), [0, 4, 1, 0, 64])
    assert.deepEqual([readState(a.player).lives, a.player.healthMax], [17, 17])
    assert.deepEqual([readState(b.player).lives, b.player.healthMax], [16, 16])
    assert.deepEqual(text(host), ["§c♥§r 8.5 / 10 Hearts", "Heart restored!"])
    assert.deepEqual(text(guest), ["§c♥§r 8 / 10 Hearts", "Half heart restored!"])
    assert.equal(a.player.forms.length, 1)
    assert.equal(b.player.forms.length, 1)
    advance(60)
    await settle()
    assert.equal(host.isShowing(), false)
    assert.equal(guest.isShowing(), false)
})

test("closing the form or a busy client leaves payment intact and permits reopening", async () => {
    const f = fixture("cancel")
    for (const reason of ["ClientClosed", "UserBusy"]) {
        const form = f.open()
        choose(form, "Half Heart")
        const pending = restore(form)
        form.dismiss(reason)
        pending.click()
        await settle()
        assert.deepEqual(f.amounts(), [2, 5, 2, 1, 64])
        assert.equal(readState(f.player).lives, 15)
    }
    assert.match(f.player.messages.at(-1), /Close the other screen/)
})

test("an invalid picker value cannot buy a recipe and switching back restores the correct preview", async () => {
    const f = fixture("bad-size")
    const form = f.open()
    const full = restore(form)
    choose(form, "Half Heart")
    const half = restore(form)
    picker(form).value.setData(2)
    assert.equal(restore(form), undefined)
    assert.deepEqual(rows(form), [])
    full.click(); half.click()
    assert.deepEqual(f.amounts(), [2, 5, 2, 1, 64])
    assert.equal(readState(f.player).lives, 15)
    choose(form, "Full Heart")
    assert.equal(restore(form), full)
    assert.equal(value(restore(form).disabled), false)
    form.dismiss()
    await settle()
})

test("a receipt and an old form ignore duplicate presses even with stock for two purchases", async () => {
    const f = fixture("repeat", 10)
    f.player.inventory.setItem(35, new Stack("minecraft:diamond", 10))
    f.player.inventory.setItem(11, new Stack("minecraft:netherite_ingot", 4))
    f.player.inventory.setItem(12, new Stack("minecraft:heart_of_the_sea", 2))
    const first = f.open()
    const oldButton = restore(first)
    oldButton.click(); oldButton.click()
    f.use(); f.use(false)
    system.advance()
    assert.deepEqual(f.amounts(), [0, 6, 2, 1, 64])
    assert.equal(readState(f.player).lives, 12)
    assert.equal(f.player.forms.length, 1)
    first.dismiss()
    await settle()
    const next = f.open()
    oldButton.click()
    assert.equal(readState(f.player).lives, 12)
    restore(next).click()
    assert.deepEqual(f.amounts(), [0, 0, 0, 0, 64])
    assert.equal(readState(f.player).lives, 14)
    next.dismiss()
    await settle()
})

test("commit rechecks the displayed price, player, table, stock and remaining capacity", async () => {
    for (const [id, change] of [
        ["missing", f => f.player.inventory.setItem(12, undefined)],
        ["removed", f => { f.block.typeId = "minecraft:air" }],
        ["distant", f => { f.player.location.x += 20 }],
        ["dimension", f => { f.player.dimension = { id: "minecraft:nether" } }],
        ["spectator", f => { f.player.mode = GameMode.Spectator }],
        ["dead", f => { f.player.health = 0; world.afterEvents.entityDie.emit({ deadEntity: f.player }) }],
        ["leave", f => world.afterEvents.playerLeave.emit({ playerId: f.player.id })],
        ["respawn", f => world.afterEvents.playerSpawn.emit({ player: f.player, initialSpawn: false })],
        ["cap", f => saved.set("waveform:hearts_lives." + f.player.id, '{"version":1,"units":20}')],
        ["new-wait", f => saved.set("waveform:hearts_lives." + f.player.id,
            JSON.stringify({ ...readState(f.player), recoveryReadyAt: 500 }))],
        ["changed-wait", () => {
            const settings = readDifficultySettings()
            settings.presets.normal.recoveryCooldownTicks = 80
            saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify(settings))
        }],
        ["settings", () => {
            const settings = readDifficultySettings()
            saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify({ ...settings, activePreset: "hard" }))
        }],
    ]) {
        const f = fixture(id)
        const form = f.open()
        change(f)
        const before = readState(f.player)
        const stock = f.amounts()
        restore(form).click()
        await settle()
        assert.deepEqual(f.amounts(), stock, id)
        assert.deepEqual(readState(f.player), before, id)
        if (id === "missing") assert.match(f.player.messages.at(-1), /Missing materials/)
        if (id === "cap") assert.equal(f.player.messages.at(-1), "ALL HEARTS RESTORED!")
        if (id === "new-wait") assert.match(f.player.messages.at(-1), /Try again in \d+ seconds/)
    }
})

test("removing the station during preview dismisses it and an old selection cannot spend on reopening", async () => {
    const f = fixture("stale-table")
    const form = f.open()
    const pending = restore(form)
    f.block.typeId = "minecraft:air"
    advance(20)
    await settle()
    assert.equal(form.isShowing(), false)
    f.block.typeId = "waveform:reanimation_table"
    const next = f.open()
    pending.click()
    assert.equal(next.isShowing(), true)
    assert.deepEqual(f.amounts(), [2, 5, 2, 1, 64])
    assert.equal(readState(f.player).lives, 15)
    next.dismiss()
    await settle()
})

test("both recipes refresh every missing ingredient and enable only at the exact threshold", async () => {
    for (const [size, diamonds, ingots] of [["Full Heart", 6, 2], ["Half Heart", 3, 1]]) {
        const f = fixture(size)
        const form = f.open()
        choose(form, size)
        for (const slot of [1, 35, 11, 12]) f.player.inventory.setItem(slot, undefined)
        advance(20)
        assert.deepEqual(rows(form).map(row => value(row.text)), [
            `§cDiamond 0/${diamonds} - Need ${diamonds}§r`, `§cNetherite 0/${ingots} - Need ${ingots}§r`,
            "§cSea Heart 0/1 - Need 1§r"])
        f.player.inventory.setItem(1, new Stack("minecraft:diamond", diamonds))
        f.player.inventory.setItem(11, new Stack("minecraft:netherite_ingot", ingots))
        advance(20)
        assert.equal(value(restore(form).disabled), true)
        restore(form).click()
        assert.deepEqual(f.amounts(), [diamonds, 0, ingots, 0, 64])
        f.player.inventory.setItem(12, new Stack("minecraft:heart_of_the_sea", 1))
        advance(20)
        assert.equal(value(restore(form).disabled), false)
        assert.ok(rows(form).every(row => value(row.text).endsWith(" - Ready§r")))
        assert.equal(readState(f.player).lives, 15)
        form.dismiss()
        await settle()
    }
})

test("the table counts permanent hearts through injury and Health Boost", async () => {
    const f = fixture("boosted-table", 18)
    f.player.effects.set("health_boost", { amplifier: 1 })
    f.player.health = 1
    const form = f.open()
    assert.equal(text(form)[0], "§c♥§r 9 / 10 Hearts")
    assert.equal(f.player.getComponent("health").effectiveMax, 26)
    assert.equal(value(restore(form).disabled), false)
    restore(form).click()
    assert.deepEqual(text(form), ["§c♥§r 10 / 10 Hearts", "ALL HEARTS RESTORED!"])
    assert.equal(f.player.getComponent("health").effectiveMax, 28)
    assert.equal(f.player.health, 1)
    form.dismiss()
    await settle()
})

test("older independent balances can limit recovery without claiming a missing heart is restored", async () => {
    const f = fixture("independent", 17)
    const key = "waveform:hearts_lives." + f.player.id
    saved.set(key, JSON.stringify({ ...readState(f.player), hunger: 20 }))
    const form = f.open()
    assert.deepEqual(text(form), ["§c♥§r 8.5 / 10 Hearts", "No hearts to restore right now."])
    assert.equal(restore(form), undefined)
    assert.deepEqual(f.amounts(), [2, 5, 2, 1, 64])
    form.dismiss()
    await settle()
})

test("the last half heart is preselected, full cannot spend, and the finished table only shows the total", async () => {
    const f = fixture("cap", 19)
    const form = f.open()
    assert.equal(picker(form).value.getData(), 1)
    choose(form, "Full Heart")
    assert.equal(restore(form).disabled.getData(), true)
    assert.ok(text(form).includes("Only half a heart will fit."))
    restore(form).click()
    assert.equal(readState(f.player).lives, 19)
    choose(form, "Half Heart")
    assert.equal(restore(form).disabled.getData(), false)
    const buyHalf = restore(form)
    buyHalf.click()
    buyHalf.click()
    await settle()
    assert.deepEqual(visible(form).map(control => control.type), ["header", "label", "close"])
    assert.deepEqual(text(form), ["§c♥§r 10 / 10 Hearts", "ALL HEARTS RESTORED!"])
    assert.equal(f.player.healthMax, 20)
    assert.deepEqual(f.amounts(), [0, 4, 1, 0, 64])
    advance(60)
    await settle()
    assert.equal(form.isShowing(), false)
    f.player.inventory.setItem(12, new Stack("minecraft:heart_of_the_sea", 1))
    const next = f.open()
    assert.deepEqual(text(next), ["§c♥§r 10 / 10 Hearts", "ALL HEARTS RESTORED!"])
    assert.equal(restore(next), undefined)
    next.dismiss()
    await settle()
})

test("cooldown countdown and changing inventory update while the table stays open", async () => {
    const settings = readDifficultySettings()
    settings.presets.normal.recoveryCooldownTicks = 40
    saved.set(DIFFICULTY_SETTINGS_KEY, JSON.stringify(settings))
    const f = fixture("cooldown")
    const first = f.open()
    choose(first, "Half Heart")
    restore(first).click()
    first.dismiss()
    await settle()
    const form = f.open()
    choose(form, "Half Heart")
    assert.ok(text(form).includes("Try again in 2 seconds."))
    assert.equal(restore(form).disabled.getData(), true)
    restore(form).click()
    assert.equal(readState(f.player).lives, 16)
    f.player.inventory.setItem(20, new Stack("minecraft:heart_of_the_sea", 2))
    advance(60)
    assert.equal(text(form).some(line => line.includes("Try again")), false)
    assert.ok(text(form).includes("§aSea Heart 1/1 - Ready§r"))
    assert.equal(restore(form).disabled.getData(), false)
    choose(form, "Full Heart")
    assert.equal(restore(form).disabled.getData(), true)
    choose(form, "Half Heart")
    restore(form).click()
    await settle()
    assert.equal(f.player.healthMax, 17)
    assert.equal(f.player.inventory.getItem(20).amount, 1)
    form.dismiss()
    await settle()
})

test("split-stack transaction compensates partial writes and verifies state before refunding", async t => {
    for (const fault of ["noop-slot", "throw-after-slot", "save-failed", "save-then-throw"]) {
        const f = fixture(fault)
        const form = f.open()
        const inv = f.player.inventory
        const previous = f.amounts()
        const write = inv.setItem.bind(inv)
        const save = world.setDynamicProperty.bind(world)
        const slotFault = t.mock.method(inv, "setItem", (slot, stack) => {
            if (slot === 12 && !stack && fault === "noop-slot") return
            write(slot, stack)
            if (slot === 12 && !stack && fault === "throw-after-slot") throw Error("after debit")
        })
        const saveFault = t.mock.method(world, "setDynamicProperty", (key, value) => {
            if (fault === "save-failed") throw Error("storage unavailable")
            save(key, value)
            if (fault === "save-then-throw") throw Error("after save")
        })
        restore(form).click()
        await settle()
        saveFault.mock.restore()
        slotFault.mock.restore()
        if (fault === "save-then-throw") {
            assert.deepEqual([readState(f.player).lives, f.player.healthMax], [17, 17])
            assert.deepEqual(f.amounts(), [0, 1, 0, 0, 64])
            assert.deepEqual(text(form), ["§c♥§r 8.5 / 10 Hearts", "Heart restored!"])
            form.dismiss()
            await settle()
        } else {
            assert.deepEqual([readState(f.player).lives, f.player.healthMax], [15, 15])
            assert.deepEqual(f.amounts(), previous)
            assert.equal(form.isShowing(), false)
            assert.equal(text(form).some(line => line.includes("restored!")), false)
        }
    }
})
