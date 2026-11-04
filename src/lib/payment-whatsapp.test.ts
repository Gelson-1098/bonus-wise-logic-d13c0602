import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildPaymentWhatsApp, paymentAmounts, type PaymentEntry } from "./payment-whatsapp";

const entry: PaymentEntry = { name: "Teste", position: "Cargo", result_status: "aprovado", no_bonus: false, approved_value: null, calculated_value: 350 };

test("pending collaborators never enter payment totals even with stored values", () => {
  assert.equal(paymentAmounts({ ...entry, result_status: "pendente", approved_value: 999 }), null);
});
test("absence of completed calculation is pending rather than a R$ 200 payment", () => {
  assert.equal(paymentAmounts({ ...entry, calculated_value: null }), null);
});
test("eliminated collaborators receive zero", () => {
  assert.deepEqual(paymentAmounts({ ...entry, result_status: "eliminado" }), { presentism: 0, goal: 0, total: 0 });
});
test("no_bonus collaborators receive zero", () => {
  assert.deepEqual(paymentAmounts({ ...entry, no_bonus: true }), { presentism: 0, goal: 0, total: 0 });
});
test("sem_bonus collaborators receive zero", () => {
  assert.deepEqual(paymentAmounts({ ...entry, result_status: "sem_bonus" }), { presentism: 0, goal: 0, total: 0 });
});
test("sem_gatilho pays exactly R$ 200 with no monthly goal", () => {
  assert.deepEqual(paymentAmounts({ ...entry, result_status: "sem_gatilho" }), { presentism: 200, goal: 0, total: 200 });
});
test("completed entries add R$ 200 to the official calculated bonus", () => {
  assert.deepEqual(paymentAmounts(entry), { presentism: 200, goal: 350, total: 550 });
});
test("approved value overrides calculated value including approved zero", () => {
  assert.deepEqual(paymentAmounts({ ...entry, approved_value: 0 }), { presentism: 200, goal: 0, total: 200 });
  assert.equal(paymentAmounts({ ...entry, approved_value: 125 })?.goal, 125);
});
test("store totals sum only released entries without mutating their values", () => {
  const entries = [entry, { ...entry, result_status: "pendente" }, { ...entry, result_status: "eliminado" }, { ...entry, result_status: "sem_gatilho" }];
  const original = structuredClone(entries);
  const result = buildPaymentWhatsApp({ storeName: "Loja", month: 11, year: 2026, entries, generatedAt: new Date() });
  assert.deepEqual(result.totals, { presentism: 400, goal: 350, total: 750 });
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(entries, original);
});
test("invalid official amounts cannot produce NaN payment totals", () => {
  assert.throws(() => paymentAmounts({ ...entry, calculated_value: "inválido" }), /inválido/);
});