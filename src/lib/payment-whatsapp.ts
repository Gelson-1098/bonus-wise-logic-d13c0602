import { brl, periodLabel } from "./format";

export type PaymentEntry = {
  name: string;
  position: string;
  result_status: string | null;
  no_bonus: boolean | null;
  approved_value: number | string | null;
  calculated_value: number | string | null;
};

export function paymentAmounts(entry: PaymentEntry) {
  if (entry.result_status === "pendente") return null;
  if (entry.no_bonus || ["eliminado", "sem_bonus"].includes(entry.result_status ?? "")) {
    return { presentism: 0, goal: 0, total: 0 };
  }
  if (entry.result_status === "sem_gatilho") {
    return { presentism: 200, goal: 0, total: 200 };
  }
  if (entry.result_status !== "aprovado" || (entry.approved_value == null && entry.calculated_value == null)) return null;
  const goal = Number(entry.approved_value ?? entry.calculated_value);
  if (!Number.isFinite(goal)) throw new Error("Há um valor de bonificação inválido na listagem.");
  const roundedGoal = Math.round(goal * 100) / 100;
  return { presentism: 200, goal: roundedGoal, total: 200 + roundedGoal };
}

export function buildPaymentWhatsApp(input: {
  storeName: string;
  month: number;
  year: number;
  entries: PaymentEntry[];
  generatedAt: Date;
}) {
  const released: string[] = [];
  const pending: string[] = [];
  let presentism = 0;
  let goalCents = 0;
  for (const entry of input.entries) {
    const amounts = paymentAmounts(entry);
    if (!amounts) {
      pending.push(`⚠️ *${entry.name}* — ${entry.position}: Lançamento Pendente`);
      continue;
    }
    presentism += amounts.presentism;
    goalCents += Math.round(amounts.goal * 100);
    released.push([
      `👤 *${entry.name}* — ${entry.position}`,
      `• Presenteísmo: ${brl(amounts.presentism)}`,
      `• Meta do Mês: ${brl(amounts.goal)}`,
      `👉 *Total Individual:* ${brl(amounts.total)}`,
    ].join("\n"));
  }
  const totals = { presentism, goal: goalCents / 100, total: presentism + goalCents / 100 };
  const separator = "━━━━━━━━━━━━━━━━━━━━━━";
  const sections = [
    "💰 *RELAÇÃO DE PAGAMENTO DE BONIFICAÇÃO — RH*",
    `🏪 *Loja:* ${input.storeName}\n📅 *Competência:* ${periodLabel(input.month, input.year)}`,
    `${separator}\n👥 *COLABORADORES (LIBERADOS PARA PAGAMENTO)*`,
    ...released,
  ];
  if (pending.length) sections.push(`${separator}\n⏳ *PENDÊNCIAS (NÃO LIBERADOS PARA PAGAMENTO)*\n${pending.join("\n")}`);
  sections.push([
    separator,
    "📊 *RESUMO GERAL DA LOJA*",
    `• Total Presenteísmo: ${brl(totals.presentism)}`,
    `• Total Meta do Mês: ${brl(totals.goal)}`,
    `💰 *TOTAL GERAL A PAGAR: ${brl(totals.total)}*`,
  ].join("\n"));
  sections.push(`_Gerado pelo PRISMA em ${input.generatedAt.toLocaleString("pt-BR")}_`);
  return { message: sections.join("\n\n"), totals, pendingCount: pending.length };
}