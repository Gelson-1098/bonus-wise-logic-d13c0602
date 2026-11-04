import { resolveStore } from "@/lib/store-registry";
import type { BenefitEntry } from "@/lib/benefits-types";

function storeIdentity(name: string) {
  const result = resolveStore({ name });
  return result.status === "ok" && result.store
    ? result.store.code
    : name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function belongsToBenefitStore(entryName: string, storeName: string) {
  return storeIdentity(entryName) === storeIdentity(storeName);
}

export function benefitPeriodClosed(statuses: Record<string, string>, storeName: string, month: number) {
  return Object.entries(statuses).some(([key, status]) => {
    const separator = key.lastIndexOf("-");
    return status === "fechado" && Number(key.slice(separator + 1)) === month
      && belongsToBenefitStore(key.slice(0, separator), storeName);
  });
}

export function canManageBenefitPeriod(statuses: Record<string, string>, storeName: string, month: number) {
  return !benefitPeriodClosed(statuses, storeName, month);
}

export function storeBenefitEntries(storeValue: unknown, legacyValue: unknown, year: number, storeName: string): BenefitEntry[] {
  const source = Array.isArray(storeValue) ? storeValue : Array.isArray(legacyValue) ? legacyValue : [];
  return source.filter((entry: BenefitEntry) => entry.year === year && belongsToBenefitStore(entry.storeName, storeName));
}