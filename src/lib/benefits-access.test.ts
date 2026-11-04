import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { assertBenefitEditScope, belongsToBenefitStore, benefitPeriodClosed, canManageBenefitPeriod, storeBenefitEntries } from "./benefits-access";

describe("Monthly benefits access", () => {
  test("Spoleto aliases identify the same store without granting Jabaquara access", () => {
    assert.equal(belongsToBenefitStore("Spoleto", "Spoleto Jabaquara"), true);
    assert.equal(belongsToBenefitStore("Jabaquara", "Spoleto Jabaquara"), false);
  });
  test("stale edit IDs cannot create another monthly entry", () => {
    assert.throws(() => assertBenefitEditScope([{ id: "original", year: 2026, month: 9 }], { id: "stale", year: 2026, month: 9 }), /não encontrado/);
  });
  test("editing cannot move an entry to a different month", () => {
    assert.throws(() => assertBenefitEditScope([{ id: "original", year: 2026, month: 9 }], { id: "original", year: 2026, month: 10 }), /competência original/);
    assert.doesNotThrow(() => assertBenefitEditScope([{ id: "original", year: 2026, month: 9 }], { id: "original", year: 2026, month: 9 }));
  });
  test("editing cannot move an entry to a different year", () => {
    assert.throws(() => assertBenefitEditScope([{ id: "original", year: 2026, month: 9 }], { id: "original", year: 2027, month: 9 }), /competência original/);
  });
  test("estimated months allow manager operations", () => {
    assert.equal(canManageBenefitPeriod({ "Jabaquara-9": "estimado" }, "Jabaquara", 9), true);
  });
  test("formally closed months prevent operations for every role", () => {
    assert.equal(canManageBenefitPeriod({ "Jabaquara-9": "fechado" }, "Jabaquara", 9), false);
  });
  test("closure remains store and month scoped", () => {
    assert.equal(benefitPeriodClosed({ "Jabaquara-9": "fechado" }, "Campo Belo", 9), false);
    assert.equal(benefitPeriodClosed({ "Jabaquara-9": "fechado" }, "Jabaquara", 10), false);
  });
  test("legacy entries are preserved only for the authorized store and year", () => {
    const legacy = [{ id: "one", year: 2026, storeName: "Jabaquara" }, { id: "other", year: 2026, storeName: "Campo Belo" }, { id: "old", year: 2025, storeName: "Jabaquara" }];
    assert.deepEqual(storeBenefitEntries(undefined, legacy, 2026, "Jabaquara").map((entry) => entry.id), ["one"]);
  });
  test("an explicitly empty per-store record does not resurrect deleted legacy entries", () => {
    assert.deepEqual(storeBenefitEntries([], [{ id: "one", year: 2026, storeName: "Jabaquara" }], 2026, "Jabaquara"), []);
  });
});