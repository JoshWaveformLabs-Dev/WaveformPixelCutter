import assert from "node:assert/strict"
import { test } from "node:test"
import {
    decodeState, deductDeath, encodeState, initialState, isEliminated, planRecovery,
} from "../.build/scripts/lives-state.js"
import { reconcileSpawn, recordDeath, TickGate } from "../.build/scripts/lives-store.js"

function memoryStore(saved = new Map()) {
    return { read: (id) => saved.get(id), write: (id, value) => saved.set(id, value) }
}

function units(state) {
    return [state.lives, state.hearts, state.hunger]
}

test("new players begin with ten lives, hearts and hunger icons", () => {
    const state = decodeState(undefined)
    assert.deepEqual(units(state), [20, 20, 20])
    assert.equal(state.awaitingRespawn, false)
    assert.equal(isEliminated(state), false)
})

test("deaths deduct exactly two units and remain armed only after a usable spawn", () => {
    const store = memoryStore()
    const first = recordDeath(store, "a")
    assert.deepEqual(units(first), [18, 18, 18])
    assert.equal(recordDeath(store, "a"), undefined)
    assert.equal(reconcileSpawn(store, "a", false).awaitingRespawn, true)
    assert.equal(recordDeath(store, "a"), undefined)
    assert.equal(reconcileSpawn(store, "a", true).awaitingRespawn, false)
    assert.deepEqual(units(recordDeath(store, "a")), [16, 16, 16])
})

test("players remain independent through overlapping callbacks and reconciliation", () => {
    const store = memoryStore()
    reconcileSpawn(store, "a", true)
    reconcileSpawn(store, "b", true)
    recordDeath(store, "a")
    assert.deepEqual(units(reconcileSpawn(store, "b", true)), [20, 20, 20])
    recordDeath(store, "b")
    reconcileSpawn(store, "a", true)
    recordDeath(store, "a")
    assert.deepEqual(units(decodeState(store.read("a"))), [16, 16, 16])
    assert.deepEqual(units(decodeState(store.read("b"))), [18, 18, 18])
})

test("same-tick deduplication is per player and permits the next tick", () => {
    const gate = new TickGate()
    assert.equal(gate.enter("a", 5), true)
    assert.equal(gate.enter("b", 5), true)
    assert.equal(gate.enter("a", 5), false)
    assert.equal(gate.enter("a", 6), true)
})

test("full and half recovery grant exact units and reject partial or over-cap grants", () => {
    const state = { ...initialState(), lives: 16, hearts: 16, hunger: 16 }
    const full = planRecovery(state, 2).state
    assert.deepEqual(units(full), [18, 18, 18])
    const half = planRecovery(full, 1).state
    assert.deepEqual(units(half), [19, 19, 19])
    assert.deepEqual(planRecovery(half, 2), { denial: "over_cap" })
    assert.deepEqual(units(planRecovery(half, 1).state), [20, 20, 20])
    assert.deepEqual(planRecovery(initialState(), 1), { denial: "over_cap" })
    assert.deepEqual(planRecovery({ ...state, hunger: 20 }, 1), { denial: "over_cap" })
    assert.deepEqual(planRecovery(deductDeath(state), 1), { denial: "awaiting_respawn" })
})

test("ten deaths or a death at one half-unit reach terminal elimination", () => {
    const store = memoryStore()
    for (let death = 1; death <= 10; death++) {
        const state = recordDeath(store, "a")
        assert.equal(state.lives, 20 - 2 * death)
        reconcileSpawn(store, "a", true)
    }
    const zero = decodeState(store.read("a"))
    assert.equal(isEliminated(zero), true)
    assert.deepEqual(planRecovery(zero, 1), { denial: "eliminated" })
    assert.equal(recordDeath(store, "a"), undefined)
    assert.deepEqual(units(deductDeath({ ...initialState(), lives: 1, hearts: 1, hunger: 1 })), [0, 0, 0])
})

test("serialization preserves half units, migrates v1, and rejects invalid or future records", () => {
    const state = { ...initialState(), lives: 9, hearts: 11, hunger: 13, awaitingRespawn: true }
    assert.deepEqual(decodeState(encodeState(state)), state)
    const store = memoryStore(new Map([["a", '{"version":1,"units":7}']]))
    assert.deepEqual(units(reconcileSpawn(store, "a", true)), [7, 7, 7])
    assert.equal(JSON.parse(store.read("a")).version, 2)
    for (const invalid of [null, 0, "", "[]", '{"version":3}', '{"version":1,"units":3.5}',
        '{"version":2,"lives":-1,"hearts":20,"hunger":20,"awaitingRespawn":false}']) {
        assert.throws(() => decodeState(invalid))
    }
})

test("the persisted death guard and eliminated state survive reload and reconnect", () => {
    const saved = new Map()
    const store = memoryStore(saved)
    recordDeath(store, "a")
    const reopened = memoryStore(new Map(saved))
    assert.equal(recordDeath(reopened, "a"), undefined)
    assert.deepEqual(units(reconcileSpawn(reopened, "a", true)), [18, 18, 18])
    reopened.write("a", '{"version":1,"units":0}')
    assert.equal(isEliminated(reconcileSpawn(reopened, "a", true)), true)
    assert.equal(isEliminated(reconcileSpawn(memoryStore(), "a", true)), false)
})

test("v2 records retain a valid additive recovery expiry and reject invalid timestamps", () => {
    const previous = initialState()
    assert.deepEqual(decodeState(encodeState(previous)), previous)
    const scheduled = { ...previous, recoveryReadyAt: 12345 }
    assert.deepEqual(decodeState(encodeState(scheduled)), scheduled)
    assert.equal(deductDeath(scheduled).recoveryReadyAt, 12345)
    for (const bad of [-1, 1.25, "10", null, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => decodeState(encodeState({ ...previous, recoveryReadyAt: bad })), /expiry/)
    }
})

test("spawn migration and death use durable readback even when a setter returns early or throws after writing", () => {
    const legacy = '{"version":1,"units":9}'
    const saved = new Map([["a", legacy]])
    const ignored = { read: (id) => saved.get(id), write() {} }
    assert.throws(() => reconcileSpawn(ignored, "a", true), /verify the life record/)
    assert.throws(() => recordDeath(ignored, "a"), /verify the life record/)
    assert.equal(saved.get("a"), legacy)

    const ambiguous = { read: ignored.read, write(id, value) {
        saved.set(id, value)
        throw new Error("setter failed after commit")
    } }
    assert.equal(reconcileSpawn(ambiguous, "a", true).hearts, 9)
    assert.equal(recordDeath(ambiguous, "a").hearts, 7)
    assert.equal(recordDeath(ambiguous, "a"), undefined)
    assert.equal(reconcileSpawn(ambiguous, "a", true).awaitingRespawn, false)
})
