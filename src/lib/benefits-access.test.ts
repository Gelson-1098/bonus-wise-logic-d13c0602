import { describe, expect, test } from "bun:test";
import { benefitPeriodClosed, canManageBenefitPeriod, storeBenefitEntries } from "./benefits-access";

describe("Monthly benefits access", () => {
  test("estimated months allow manager operations", () => {
    expect(canManageBenefitPeriod({ "Jabaquara-9": "estimado" }, "Jabaquara", 9)).toBe(true);
  });
  test("formally closed months prevent operations for every role", () => {
    expect(canManageBenefitPeriod({ "Jabaquara-9": "fechado" }, "Jabaquara", 9)).toBe(false);
  });
  test("closure remains store and month scoped", () => {
    expect(benefitPeriodClosed({ "Jabaquara-9": "fechado" }, "Campo Belo", 9)).toBe(false);
    expect(benefitPeriodClosed({ "Jabaquara-9": "fechado" }, "Jabaquara", 10)).toBe(false);
  });
  test("legacy entries are preserved only for the authorized store and year", () => {
    const legacy = [{ id: "one", year: 2026, storeName: "Jabaquara" }, { id: "other", year: 2026, storeName: "Campo Belo" }, { id: "old", year: 2025, storeName: "Jabaquara" }];
    expect(storeBenefitEntries(undefined, legacy, 2026, "Jabaquara").map((entry) => entry.id)).toEqual(["one"]);
  });
  test("an explicitly empty per-store record does not resurrect deleted legacy entries", () => {
    expect(storeBenefitEntries([], [{ id: "one", year: 2026, storeName: "Jabaquara" }], 2026, "Jabaquara")).toEqual([]);
  });
});