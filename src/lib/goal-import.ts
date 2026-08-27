import { MONTHS } from "@/lib/format";

export type ColumnMap = {
  store: string;
  month: string;
  receita: string;
  taxa: string;
  tc: string;
};

export type ParsedRow = {
  index: number;
  storeName: string;
  storeId: string | null;
  month: number | null;
  receita: number | null;
  taxa: number | null;
  tc: number | null;
  errors: string[];
};

export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Converte valores pt-BR ("R$ 1.234,56") ou numéricos em number. */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let text = String(raw).trim().replace(/r\$/i, "").replace(/\s/g, "");
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  const n = Number(text.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTH_KEYS = MONTHS.map((m) => normalize(m));
const SHORT_KEYS = MONTH_KEYS.map((m) => m.slice(0, 3));

/** Aceita 1-12, "Janeiro", "jan", "01/2025" e datas do Excel. */
export function parseMonth(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) return raw.getMonth() + 1;
  if (typeof raw === "number") {
    if (raw >= 1 && raw <= 12 && Number.isInteger(raw)) return raw;
    return null;
  }
  const text = normalize(String(raw));
  const exact = MONTH_KEYS.indexOf(text);
  if (exact >= 0) return exact + 1;
  const short = SHORT_KEYS.indexOf(text.slice(0, 3));
  if (short >= 0 && text.length >= 3) return short + 1;
  const slash = String(raw).match(/^(\d{1,2})[/-]\d{2,4}$/);
  if (slash) {
    const n = Number(slash[1]);
    if (n >= 1 && n <= 12) return n;
  }
  const num = Number(text);
  if (Number.isInteger(num) && num >= 1 && num <= 12) return num;
  return null;
}

export function guessColumn(headers: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const found = headers.find((h) => normalize(h) === normalize(candidate));
    if (found) return found;
  }
  for (const candidate of candidates) {
    const found = headers.find((h) => normalize(h).includes(normalize(candidate)));
    if (found) return found;
  }
  return "";
}

export const COLUMN_HINTS: Record<keyof ColumnMap, string[]> = {
  store: ["loja", "coluna d", "d", "unidade", "filial", "restaurante", "store"],
  month: ["mes", "mês", "coluna f", "f", "periodo", "competencia", "data"],
  receita: [
    "faturamento",
    "coluna h",
    "h",
    "faturamento/vendas",
    "faturamento de vendas",
    "receita de vendas",
    "receita vendas",
    "vendas",
    "faturamento liquido sem taxa",
    "faturamento liquido",
    "receita",
  ],
  taxa: ["taxa de servico", "taxa servico", "taxa de serviço", "taxa"],
  tc: [
    "tc — quantidade de clientes/pedidos atendidos",
    "tc - quantidade de clientes/pedidos atendidos",
    "quantidade de clientes/pedidos atendidos",
    "clientes/pedidos atendidos",
    "coluna l",
    "l",
    "tc",
    "total de clientes",
    "clientes atendidos",
    "clientes",
    "pedidos",
    "cupons",
  ],
};

export function matchStore(
  name: string,
  stores: Array<{ id: string; name: string; code: string | null }>,
) {
  const key = normalize(name);
  if (!key) return null;
  const exact = stores.find((s) => normalize(s.name) === key || (s.code && normalize(s.code) === key));
  if (exact) return exact.id;
  const partial = stores.find(
    (s) => normalize(s.name).includes(key) || key.includes(normalize(s.name)),
  );
  return partial?.id ?? null;
}

export function buildRows(
  raw: Array<Record<string, unknown>>,
  map: ColumnMap,
  stores: Array<{ id: string; name: string; code: string | null }>,
  overrides: Record<string, string>,
): ParsedRow[] {
  return raw.map((line, i) => {
    const storeName = String(line[map.store] ?? "").trim();
    const key = normalize(storeName);
    const storeId = overrides[key] ?? matchStore(storeName, stores);
    const month = parseMonth(line[map.month]);
    const receita = parseNumber(line[map.receita]);
    const taxa = map.taxa ? parseNumber(line[map.taxa]) : 0;
    const tc = parseNumber(line[map.tc]);
    const errors: string[] = [];
    if (!storeName) errors.push("Loja sem nome");
    else if (!storeId) errors.push("Loja não cadastrada no sistema");
    if (!month) errors.push("Mês ausente ou inválido");
    if (receita === null) errors.push("Faturamento inválido");
    else if (receita < 0) errors.push("Faturamento negativo");
    if (taxa !== null && taxa < 0) errors.push("Taxa de serviço negativa");
    if (tc === null) errors.push("TC inválido");
    else if (tc < 0) errors.push("TC negativo");
    return {
      index: i + 2,
      storeName,
      storeId: storeId ?? null,
      month,
      receita,
      taxa: taxa ?? 0,
      tc,
      errors,
    };
  });
}

export function duplicateKeys(rows: ParsedRow[]) {
  const seen = new Map<string, number>();
  const dups = new Set<string>();
  for (const r of rows) {
    if (!r.storeId || !r.month) continue;
    const key = `${r.storeId}-${r.month}`;
    if (seen.has(key)) dups.add(key);
    seen.set(key, r.index);
  }
  return dups;
}
