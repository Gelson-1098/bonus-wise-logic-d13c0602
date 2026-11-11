import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildPaymentWhatsApp, paymentAmounts, type PaymentEntry } from "./payment-whatsapp";

const context = { month: 10, year: 2026, periodStatus: "aprovado" };
function entry(position = "Operador", total = 380, presentism = 200): PaymentEntry {
  return { name: "Beatriz", position, result_status: "aprovado", no_bonus: false, approved_value: null, calculated_value: total,
    calc_snapshot: { period: { month: 10, year: 2026 }, output: { status: "aprovado", filled: true, total, cappedAt: null, lines: [
      ...(presentism ? [{ name: "Presenteísmo", value_brl: presentism, awarded: presentism, status: "atingiu", is_eliminatory: false }] : []),
      { name: "Indicadores", value_brl: total - presentism, awarded: total - presentism, status: "atingiu", is_eliminatory: false },
      { name: "Falta injustificada", awarded: 0, status: "atingiu", is_eliminatory: true },
    ] } } };
}
function output(e: PaymentEntry) { return e.calc_snapshot as { period: { month: number; year: number }; output: { status: string; filled: boolean; cappedAt: number | null; lines: { name: string; awarded: number; status: string; is_eliminatory: boolean }[] } }; }

test("Beatriz total 380 already includes 200 presentism and 180 meta", () => {
  assert.deepEqual(paymentAmounts(entry(), context), { presentism: 200, goal: 180, total: 380 });
});
test("Trainee total 475 includes exactly 250 presentism", () => {
  assert.deepEqual(paymentAmounts(entry("Gerente Trainee", 475, 250), context), { presentism: 250, goal: 225, total: 475 });
});
test("Gerente receives zero presentism and only official 570", () => {
  assert.deepEqual(paymentAmounts(entry("Gerente", 570, 0), context), { presentism: 0, goal: 570, total: 570 });
  assert.equal(paymentAmounts(entry("Gerente", 570, 200), context), null);
});
test("unknown position without configured presentism stays pending", () => {
  assert.equal(paymentAmounts(entry("Desconhecido", 100, 0), context), null);
});
test("other registered positions use proven snapshot amount", () => {
  assert.deepEqual(paymentAmounts(entry("Instrutor III", 380, 200), context), { presentism: 200, goal: 180, total: 380 });
});
test("operators and trainees cannot use incorrect amounts", () => {
  assert.equal(paymentAmounts(entry("Operador", 380, 250), context), null);
  assert.equal(paymentAmounts(entry("Gerente Trainee", 475, 200), context), null);
});
test("failed or ambiguous eliminatory never releases presentism", () => {
  for (const status of ["nao_atingiu", "nao_aplicavel"]) {
    const e = entry(); output(e).output.lines[2].status = status;
    assert.equal(paymentAmounts(e, context), null);
  }
});
test("incomplete criteria or missing snapshot are pending", () => {
  const e = entry(); output(e).output.filled = false;
  assert.equal(paymentAmounts(e, context), null);
  assert.equal(paymentAmounts({ ...entry(), calc_snapshot: null }, context), null);
});
test("sem_gatilho never manufactures a payment from snapshot awards", () => {
  assert.equal(paymentAmounts({ ...entry(), calculated_value: 0, result_status: "sem_gatilho" }, context), null);
});
test("pending values never enter totals", () => {
  assert.equal(paymentAmounts({ ...entry(), result_status: "pendente", approved_value: 999 }, context), null);
});
test("unapproved reopened or correction periods cannot release payments", () => {
  for (const periodStatus of ["aberto", "em_preenchimento", "enviado", "em_conferencia", "correcao_solicitada"]) {
    assert.equal(paymentAmounts(entry(), { ...context, periodStatus }), null);
  }
});
test("closed and paid approved periods retain official composition", () => {
  for (const periodStatus of ["fechado", "pago"]) assert.equal(paymentAmounts(entry(), { ...context, periodStatus })?.total, 380);
});
test("explicit approved zero is preserved and nonzero divergence is pending", () => {
  assert.deepEqual(paymentAmounts({ ...entry(), approved_value: 0 }, context), { presentism: 0, goal: 0, total: 0 });
  assert.equal(paymentAmounts({ ...entry(), approved_value: 350 }, context), null);
});
test("eliminated and no bonus entries are zero", () => {
  for (const result_status of ["eliminado", "sem_bonus"]) assert.equal(paymentAmounts({ ...entry(), result_status }, context)?.total, 0);
  assert.equal(paymentAmounts({ ...entry(), no_bonus: true }, context)?.total, 0);
});
test("wrong competence is pending", () => {
  assert.equal(paymentAmounts(entry(), { ...context, month: 8 }), null);
  assert.equal(paymentAmounts(entry(), { ...context, year: 2025 }), null);
});
test("capped or irreconcilable composition is not silently changed", () => {
  const e = entry(); output(e).output.cappedAt = 380;
  assert.equal(paymentAmounts(e, context), null);
  const broken = entry(); output(broken).output.lines[1].awarded = 170;
  assert.equal(paymentAmounts(broken, context), null);
});
test("invalid amounts remain pending without NaN", () => {
  for (const calculated_value of ["inválido", -1, Infinity, ""]) assert.equal(paymentAmounts({ ...entry(), calculated_value }, context), null);
});
test("total general sums exactly official amounts without mutating records", () => {
  const entries = [entry(), entry("Gerente Trainee", 475, 250), entry("Gerente", 570, 0), { ...entry(), result_status: "pendente" }];
  const original = structuredClone(entries);
  const result = buildPaymentWhatsApp({ storeName: "Loja selecionada", ...context, entries, generatedAt: new Date() });
  assert.deepEqual(result.totals, { presentism: 450, goal: 975, total: 1425 });
  assert.equal(result.pendingCount, 1);
  assert.deepEqual(entries, original);
});