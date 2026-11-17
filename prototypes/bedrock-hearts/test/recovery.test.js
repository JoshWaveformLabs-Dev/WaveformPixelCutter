import assert from "node:assert/strict"
import { test } from "node:test"
import { decodeState, encodeState, initialState } from "../.build/scripts/lives-state.js"
import { recover } from "../.build/scripts/recovery.js"

const FULL = "waveform:artificial_heart"
const HALF = "waveform:half_artificial_heart"

class Stack {
    constructor(typeId, amount, name = "") {
        Object.assign(this, { typeId, amount, name })
    }

    clone() {
        return new Stack(this.typeId, this.amount, this.name)
    }

    isStackableWith(other) {
        return this.typeId === other.typeId && this.name === other.name
    }
}

function fixture({ type = FULL, amount = 3, units = 16 } = {}) {
    let current = new Stack(type, amount)
    let record = encodeState({ ...initialState(), lives: units, hearts: units, hunger: units })
    const store = { read: () => record, write: (_id, value) => { record = value } }
    const slot = { read: () => current?.clone(), write: (stack) => { current = stack?.clone() },
        isSelected: () => true }
    return { store, slot, used: current.clone(), raw: record }
}

test("recovery consumes exactly one item from a stack or clears a single-item slot", () => {
    const full = fixture()
    const half = fixture({ type: HALF, amount: 1 })
    assert.equal(recover(full.store, "a", full.slot, full.used, 2).state.lives, 18)
    assert.equal(full.slot.read().amount, 2)
    assert.equal(recover(half.store, "a", half.slot, half.used, 1).state.lives, 17)
    assert.equal(half.slot.read(), undefined)
})

test("over-cap and eliminated requests preserve inventory and storage", () => {
    for (const [units, denial] of [[19, "over_cap"], [20, "over_cap"], [0, "eliminated"]]) {
        const { store, slot, used, raw } = fixture({ units })
        slot.write = () => assert.fail("attempted debit for a denied recovery")
        store.write = () => assert.fail("attempted state write for a denied recovery")
        assert.deepEqual(recover(store, "a", slot, used, 2), { denial })
        assert.equal(store.read(), raw)
        assert.deepEqual(slot.read(), used)
    }
})

test("stale type, metadata, count, slot, or empty slot cannot debit now-held inventory", () => {
    for (const replacement of [new Stack(HALF, 3), new Stack(FULL, 2), new Stack(FULL, 3, "Different"),
        undefined, new Stack(FULL, 3)]) {
        const { store, slot, used, raw } = fixture()
        slot.write(replacement)
        if (replacement?.typeId === FULL && replacement.amount === 3 && replacement.name === "") {
            slot.isSelected = () => false
        }
        assert.deepEqual(recover(store, "a", slot, used, 2), { denial: "stale_item" })
        assert.equal(store.read(), raw)
        assert.deepEqual(slot.read(), replacement)
    }
})

test("a repeated event with its original snapshot cannot consume another item", () => {
    const { store, slot, used } = fixture({ units: 12 })
    recover(store, "a", slot, used, 2)
    assert.deepEqual(recover(store, "a", slot, used, 2), { denial: "stale_item" })
    assert.equal(slot.read().amount, 2)
    assert.equal(decodeState(store.read()).lives, 14)
})

test("debit rejection or a no-op debit cannot grant state", () => {
    for (const debit of [() => {}, () => { throw new Error("debit rejected") }]) {
        const { store, slot, used, raw } = fixture()
        slot.write = debit
        assert.throws(() => recover(store, "a", slot, used, 2), /debit/)
        assert.equal(store.read(), raw)
        assert.deepEqual(slot.read(), used)
    }
})

test("a debit that throws after changing the slot restores the original stack", () => {
    const { store, slot, used, raw } = fixture({ amount: 1 })
    const write = slot.write
    slot.write = (stack) => {
        write(stack)
        if (stack === undefined) {
            throw new Error("after debit")
        }
    }
    assert.throws(() => recover(store, "a", slot, used, 2), /after debit/)
    assert.deepEqual(slot.read(), used)
    assert.equal(store.read(), raw)
})

test("failed and no-op state writes compensate an exact debit", () => {
    for (const save of [() => {}, () => { throw new Error("storage full") }]) {
        const { store, slot, used, raw } = fixture({ amount: 1 })
        store.write = save
        assert.throws(() => recover(store, "a", slot, used, 2), /storage full|did not persist/)
        assert.deepEqual(slot.read(), used)
        assert.equal(store.read(), raw)
    }
})

test("state that was committed before a throw does not get a duplicate refunded item", () => {
    const { store, slot, used } = fixture()
    const write = store.write
    store.write = (id, encoded) => {
        write(id, encoded)
        throw new Error("after save")
    }
    assert.equal(recover(store, "a", slot, used, 2).state.lives, 18)
    assert.equal(slot.read().amount, 2)
})

test("compensation refuses to overwrite a slot that changed after the debit", () => {
    const { store, slot, used } = fixture()
    const other = new Stack(HALF, 2)
    store.write = () => {
        slot.write(other)
        throw new Error("storage full")
    }
    assert.throws(() => recover(store, "a", slot, used, 2), /rollback could not confirm/)
    assert.deepEqual(slot.read(), other)
})

test("unknown write outcome does not mint an item or overwrite unexpected state", () => {
    const { store, slot, used } = fixture()
    const unexpected = encodeState({ ...initialState(), lives: 12, hearts: 12, hunger: 12 })
    const write = store.write
    store.write = (id) => write(id, unexpected)
    assert.throws(() => recover(store, "a", slot, used, 2), /indeterminate/)
    assert.equal(store.read(), unexpected)
    assert.equal(slot.read().amount, 2)
})
