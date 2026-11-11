import { brl, periodLabel } from "./format";

export type PaymentEntry = {
  name: string;
  position: string;
  result_status: string | null;
  no_bonus: boolean | null;
  approved_value: number | string | null;
  calculated_value: number | string | null;
  calc_snapshot: unknown;
};

type PaymentContext = { month: number; year: number; periodStatus: string | null };
const approvedPeriods = new Set(["aprovado", "fechado", "pago"]);
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const normalized = (value: unknown) => typeof value === "string" ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";
const cents = (value: unknown): number | null => {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
};

export function paymentAmounts(entry: PaymentEntry, context: PaymentContext) {
  if (!approvedPeriods.has(context.periodStatus ?? "")) return null;
  if (entry.no_bonus || ["eliminado", "sem_bonus"].includes(entry.result_status ?? "")) {
    return { presentism: 0, goal: 0, total: 0 };
  }
  if (entry.result_status !== "aprovado") return null;
  const snapshot = record(entry.calc_snapshot);
  const period = record(snapshot?.["period"]);
  const output = record(snapshot?.["output"]);
  if (period?.["month"] !== context.month || period?.["year"] !== context.year || output?.["status"] !== "aprovado" || output["filled"] !== true || !Array.isArray(output["lines"])) return null;
  const lines = output["lines"].map(record);
  if (lines.some((line) => !line || (line["is_eliminatory"] === true && line["status"] !== "atingiu"))) return null;
  const total = cents(entry.approved_value ?? entry.calculated_value);
  const calculated = cents(entry.calculated_value);
  if (total === null || calculated === null || cents(output["total"]) !== calculated) return null;
  // An explicit zero approval must never be turned into a presentism payment.
  if (total === 0) return { presentism: 0, goal: 0, total: 0 };
  if (total !== calculated || output["cappedAt"] != null) return null;
  const awarded = lines.map((line) => cents(line?.["awarded"]));
  if (awarded.some((value) => value === null) || awarded.reduce<number>((sum, value) => sum + (value ?? 0), 0) !== total) return null;
  const presentLines = lines.filter((line) => normalized(line?.["name"]) === "presenteismo");
  if (presentLines.length > 1) return null;
  const presentLine = presentLines[0];
  const position = normalized(entry.position);
  const managers = new Set(["gerente", "gerente jr", "gerente pj", "gerente pleno ii", "gerente pleno iii", "gerente senior"]);
  if (managers.has(position) && presentLine) return null;
  const configured = cents(presentLine?.["value_brl"]);
  if (position === "operador" && configured !== 20000) return null;
  if (position === "gerente trainee" && configured !== 25000) return null;
  if (!presentLine && !managers.has(position)) return null;
  const presentism = presentLine?.["status"] === "atingiu" ? cents(presentLine["awarded"]) : 0;
  if (presentism === null || (presentism > 0 && presentism !== configured) || presentism > total) return null;
  return { presentism: presentism / 100, goal: (total - presentism) / 100, total: total / 100 };
}

export function buildPaymentWhatsApp(input: {
  storeName: string;
  month: number;
  year: number;
  periodStatus: string | null;
  entries: PaymentEntry[];
  generatedAt: Date;
}) {
  const released: string[] = [];
  const pending: string[] = [];
  let presentism = 0;
  let goalCents = 0;
  for (const entry of input.entries) {
    const amounts = paymentAmounts(entry, { month: input.month, year: input.year, periodStatus: input.periodStatus });
    if (!amounts) {
      pending.push(`⚠️ *${entry.name}* — ${entry.position}: Pendente de aprovação ou conferência da composição`);
      continue;
    }
    presentism += amounts.presentism;
    goalCents += Math.round(amounts.goal * 100);
    released.push([
      `*COLABORADOR: ${entry.name}*`,
      `Cargo: ${entry.position}`,
      `• Presenteísmo: ${brl(amounts.presentism)}`,
      `• Bônus por Meta: ${brl(amounts.goal)}`,
      `*TOTAL A PAGAR: ${brl(amounts.total)}*`,
    ].join("\n"));
  }
  const totals = { presentism, goal: goalCents / 100, total: presentism + goalCents / 100 };
  const separator = "━━━━━━━━━━━━━━━━━━━━━━";
  const sections = [
    "*BONIFICAÇÃO PARA PAGAMENTO*",
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

export async function copyPaymentText(message: string) {
  try {
    await navigator.clipboard.writeText(message);
    return;
  } catch {
    const previousFocus = document.activeElement;
    const textarea = document.createElement("textarea");
    textarea.value = message;
    textarea.className = "fixed left-0 top-0 h-px w-px opacity-0";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    try {
      textarea.select();
      if (!document.execCommand("copy")) throw new Error("Não foi possível copiar. Permita o acesso à área de transferência e tente novamente.");
    } finally {
      textarea.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    }
  }
}