import { MONTHS } from "@/lib/format";
import { CANONICAL_STORES } from "@/lib/official-pdf-data";

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

export type AutoImportedRow = {
  id: string;
  sourceSheet: string;
  rowNumber: number;
  rawStore: string;
  storeName: string;
  storeId: string | null;
  canonicalKey: string | null;
  code: string | null;
  month: number;
  year: number;
  faturamentoRealizado: number | null;
  faturamentoOrcado: number | null;
  faturamentoBaseAnoAnterior: number | null;
  tc: number | null;
  isValid: boolean;
  statusText: string;
  errors: string[];
};

export type AutoImportResult = {
  rows: AutoImportedRow[];
  detectedStoresCount: number;
  totalRowsFound: number;
  totalFaturamentoRealizado: number;
  totalFaturamentoOrcado: number;
  unmappedStores: string[];
  detectedStores: string[];
};

export function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
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
  if (slash && slash[1]) {
    const n = Number(slash[1]);
    if (n >= 1 && n <= 12) return n;
  }
  const num = Number(text);
  if (Number.isInteger(num) && num >= 1 && num <= 12) return num;
  return null;
}

export function parseMonthText(text: string): number | null {
  if (!text) return null;
  const norm = normalize(text);
  for (let i = 0; i < MONTHS.length; i++) {
    const mNorm = normalize(MONTHS[i]);
    const mShort = mNorm.slice(0, 3);
    if (norm.includes(mNorm) || norm.includes(mShort)) {
      return i + 1;
    }
  }
  const matchSlash = String(text).match(/(\d{1,2})[/-](\d{2,4})/);
  if (matchSlash && matchSlash[1]) {
    const m = Number(matchSlash[1]);
    if (m >= 1 && m <= 12) return m;
  }
  return null;
}

export function parseYearText(text: string): number | null {
  if (!text) return null;
  const matchYear = String(text).match(/202[4-9]/);
  if (matchYear) return Number(matchYear[0]);
  return null;
}

export function normalizeStoreName(name: string) {
  let s = normalize(name);
  const BRAND_RE = /^(domino'?s\s*[-–]?\s*|pizza\s*hut\s*[-–]?\s*|subway\s*[-–]?\s*|burger\s*king\s*[-–]?\s*|mc\s*donalds?\s*[-–]?\s*|kfc\s*[-–]?\s*)/;
  const PREFIX_RE = /^(sp|es|rj|mg|pr|sc|ba|ce|go|df|rs|pe|am|pa|ma|al|pi|pb|rn|se|ac|ap|ro|rr|to|ms|mt)\s+[-–]?\s*/;
  const TYPE_RE = /^(loja|restaurante|filial|unidade|store|pdv|ponto)\s+/;
  const SUFFIX_RE = /\s+(sp|es|rj|mg|loja)\s*$/;

  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(BRAND_RE, "").trim();
  }
  prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(PREFIX_RE, "").replace(TYPE_RE, "").replace(SUFFIX_RE, "").trim();
  }
  return s.replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchStore(
  name: string,
  stores?: Array<{ id: string; name: string; code: string | null }>,
) {
  if (!name) return null;
  const key = normalize(name);
  if (!key) return null;

  // 1. Check against DB stores if provided
  if (stores && stores.length > 0) {
    const dbExact = stores.find(
      (s) => normalize(s.name) === key || (s.code && normalize(s.code) === key)
    );
    if (dbExact) return dbExact.id;
  }

  // 2. Exact match with Canonical Stores & Aliases
  for (const cs of CANONICAL_STORES) {
    if (normalize(cs.name) === key || normalize(cs.code) === key || normalize(cs.key) === key) {
      const matchedDb = (stores ?? []).find(
        (s) => normalize(s.name) === normalize(cs.name) || normalize(s.name) === normalize(cs.key)
      );
      return matchedDb ? matchedDb.id : cs.name;
    }
    if (cs.aliases && cs.aliases.some((a) => normalize(a) === key)) {
      const matchedDb = (stores ?? []).find(
        (s) => normalize(s.name) === normalize(cs.name) || normalize(s.name) === normalize(cs.key)
      );
      return matchedDb ? matchedDb.id : cs.name;
    }
  }

  // 3. Clean normalized match
  const cleanKey = normalizeStoreName(name);
  for (const cs of CANONICAL_STORES) {
    const sClean = normalizeStoreName(cs.name);
    if (sClean === cleanKey) {
      const matchedDb = (stores ?? []).find(
        (s) => normalize(s.name) === normalize(cs.name) || normalize(s.name) === normalize(cs.key)
      );
      return matchedDb ? matchedDb.id : cs.name;
    }
    if (cs.aliases && cs.aliases.some((a) => normalizeStoreName(a) === cleanKey)) {
      const matchedDb = (stores ?? []).find(
        (s) => normalize(s.name) === normalize(cs.name) || normalize(s.name) === normalize(cs.key)
      );
      return matchedDb ? matchedDb.id : cs.name;
    }
  }

  // 4. Strict includes match (minimum length 4 chars to avoid false positives)
  for (const cs of CANONICAL_STORES) {
    const sClean = normalizeStoreName(cs.name);
    if (sClean.length >= 4 && (cleanKey.includes(sClean) || sClean.includes(cleanKey))) {
      const matchedDb = (stores ?? []).find(
        (s) => normalize(s.name) === normalize(cs.name) || normalize(s.name) === normalize(cs.key)
      );
      return matchedDb ? matchedDb.id : cs.name;
    }
    if (
      cs.aliases &&
      cs.aliases.some((a) => {
        const aClean = normalizeStoreName(a);
        return aClean.length >= 4 && (cleanKey.includes(aClean) || aClean.includes(cleanKey));
      })
    ) {
      const matchedDb = (stores ?? []).find(
        (s) => normalize(s.name) === normalize(cs.name) || normalize(s.name) === normalize(cs.key)
      );
      return matchedDb ? matchedDb.id : cs.name;
    }
  }

  return null;
}

/** Encontra a linha de cabeçalho real da tabela ignorando linhas de título/banners */
export function findHeaderRowIndex(rawRows: unknown[][]): number {
  let bestIdx = -1;
  let maxScore = -1;

  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const nonEmpties = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonEmpties.length < 2) continue;

    let score = 0;
    const lowerCells = nonEmpties.map((c) => String(c).toLowerCase().trim());

    if (lowerCells.some((c) => c === "loja" || c === "unidade" || c === "filial" || c === "sigla" || c === "uf")) score += 5;
    if (lowerCells.some((c) => c.includes("faturamento") || c.includes("receita") || c.includes("vendas") || c.includes("realizado") || c.includes("real"))) score += 4;
    if (lowerCells.some((c) => c.includes("meta") || c.includes("orçado") || c.includes("orcado"))) score += 3;
    if (lowerCells.some((c) => c.includes("tc") || c.includes("atendimento") || c.includes("pedidos") || c.includes("clientes"))) score += 3;

    if (score > maxScore) {
      maxScore = score;
      bestIdx = i;
    }
  }

  return maxScore >= 4 ? bestIdx : 0;
}

/** Leitor e extrator automático multi-abas e multi-lojas */
export function parseWorkbookAuto(
  wb: any,
  defaultYear = 2026,
  stores: Array<{ id: string; name: string; code: string | null }> = [],
  overrides: Record<string, string> = {}
): AutoImportResult {
  const allRows: AutoImportedRow[] = [];
  const detectedStores = new Set<string>();
  const unmappedStores = new Set<string>();

  const sheetNames = (wb.SheetNames || []) as string[];

  for (const sheetName of sheetNames) {
    if (normalize(sheetName).includes("parametro") || normalize(sheetName).includes("config")) continue;

    const ws = wb.Sheets[sheetName];
    const rawRows = ((wb.XLSX || (globalThis as any).XLSX)?.utils?.sheet_to_json(ws, { header: 1 }) as unknown[][]) || [];
    if (!rawRows || rawRows.length < 2) continue;

    let sheetMonth = parseMonthText(sheetName);
    let sheetYear = parseYearText(sheetName) || defaultYear;

    const hIdx = findHeaderRowIndex(rawRows);
    if (rawRows.length <= hIdx + 1) continue;

    // Detect month and year in top banner if not in sheet name
    for (let i = 0; i <= hIdx; i++) {
      const rowText = (rawRows[i] || []).map((c) => String(c || "")).join(" ");
      if (!sheetMonth) sheetMonth = parseMonthText(rowText);
      const foundY = parseYearText(rowText);
      if (foundY) sheetYear = foundY;
    }

    const header = (rawRows[hIdx] || []).map((c) => String(c || "").trim());

    // Mapear índices de colunas
    let storeCol = -1;
    let siglaCol = -1;
    let monthCol = -1;
    let realFatCol = -1;
    let orcadoFatCol = -1;
    let baseFatCol = -1;
    let tcCol = -1;

    header.forEach((h, idx) => {
      const nh = normalize(h);
      if (nh === "loja" || nh === "unidade" || nh === "filial" || nh === "store" || nh === "estabelecimento") storeCol = idx;
      if (nh === "sigla" || nh === "codigo" || nh === "cod") siglaCol = idx;
      if (nh.includes("mes") || nh.includes("periodo") || nh.includes("data") || nh.includes("competencia")) monthCol = idx;

      // Realizado
      if (
        nh.includes("real") ||
        nh.includes("realizado") ||
        (nh.includes("faturamento") && !nh.includes("meta") && !nh.includes("anterior") && !nh.includes("2025") && !nh.includes("orcado"))
      ) {
        if (realFatCol === -1 || nh.includes("real")) realFatCol = idx;
      }

      // Meta / Orçado
      if (nh.includes("meta") || nh.includes("orcado") || nh.includes("orçado")) {
        if (!nh.includes("%") && !nh.includes("acrescimo") && !nh.includes("atingimento") && !nh.includes("dif")) {
          orcadoFatCol = idx;
        }
      }

      // Base anterior
      if (nh.includes("2025") || nh.includes("anterior") || nh.includes("base")) {
        if (!nh.includes("%") && !nh.includes("meta")) baseFatCol = idx;
      }

      // TC
      if (nh.includes("tc") || nh.includes("pedidos") || nh.includes("clientes") || nh.includes("atendimentos")) {
        tcCol = idx;
      }
    });

    const sheetStoreMatched = matchStore(sheetName, stores);

    for (let r = hIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r] as unknown[];
      if (!row || row.length === 0) continue;

      const storeRaw =
        (storeCol >= 0 ? row[storeCol] : null) ||
        (siglaCol >= 0 ? row[siglaCol] : null) ||
        (sheetStoreMatched ? sheetName : null);

      if (!storeRaw) continue;
      const storeStr = String(storeRaw).trim();
      if (!storeStr || normalize(storeStr).includes("total") || normalize(storeStr).includes("consolidado")) continue;

      const rawKey = normalize(storeStr);
      const storeIdOverride = overrides[rawKey];

      let matchedStoreId: string | null = null;
      let matchedCanonicalName: string = storeStr;

      if (storeIdOverride) {
        matchedStoreId = storeIdOverride;
        const dbStore = stores.find((s) => s.id === storeIdOverride);
        if (dbStore) matchedCanonicalName = dbStore.name;
      } else {
        const matched = matchStore(storeStr, stores) || (siglaCol >= 0 ? matchStore(String(row[siglaCol]), stores) : null);
        if (matched) {
          if (typeof matched === "string") {
            const dbStore = stores.find((s) => normalize(s.name) === normalize(matched) || s.id === matched);
            matchedStoreId = dbStore ? dbStore.id : null;
            matchedCanonicalName = dbStore ? dbStore.name : matched;
          }
        }
      }

      let rowMonth = monthCol >= 0 ? parseMonthText(String(row[monthCol])) : null;
      if (!rowMonth) rowMonth = sheetMonth || 1;

      const realFat = realFatCol >= 0 ? parseNumber(row[realFatCol]) : null;
      const orcadoFat = orcadoFatCol >= 0 ? parseNumber(row[orcadoFatCol]) : null;
      const baseFat = baseFatCol >= 0 ? parseNumber(row[baseFatCol]) : null;
      const tc = tcCol >= 0 ? parseNumber(row[tcCol]) : null;

      const errors: string[] = [];
      if (!matchedStoreId && !matchedCanonicalName) {
        errors.push("Loja não cadastrada no sistema");
        unmappedStores.add(storeStr);
      } else {
        detectedStores.add(matchedCanonicalName);
      }

      if (!rowMonth) errors.push("Mês não identificado");
      if (realFat === null && orcadoFat === null && baseFat === null) errors.push("Faturamento ausente");

      const isValid = errors.length === 0;

      allRows.push({
        id: `imp-${rawKey}-${sheetYear}-${rowMonth}-${r}`,
        sourceSheet: sheetName,
        rowNumber: r + 1,
        rawStore: storeStr,
        storeName: matchedCanonicalName,
        storeId: matchedStoreId,
        canonicalKey: rawKey,
        code: null,
        month: rowMonth,
        year: sheetYear,
        faturamentoRealizado: realFat,
        faturamentoOrcado: orcadoFat,
        faturamentoBaseAnoAnterior: baseFat,
        tc: tc,
        isValid,
        statusText: isValid ? "✓ OK" : "⚠️ Loja não identificada",
        errors,
      });
    }
  }

  let totalFaturamentoRealizado = 0;
  let totalFaturamentoOrcado = 0;

  for (const r of allRows) {
    if (r.isValid) {
      if (r.faturamentoRealizado) totalFaturamentoRealizado += r.faturamentoRealizado;
      if (r.faturamentoOrcado) totalFaturamentoOrcado += r.faturamentoOrcado;
    }
  }

  return {
    rows: allRows,
    detectedStoresCount: detectedStores.size,
    totalRowsFound: allRows.length,
    totalFaturamentoRealizado,
    totalFaturamentoOrcado,
    unmappedStores: Array.from(unmappedStores),
    detectedStores: Array.from(detectedStores),
  };
}

export const COLUMN_HINTS: Record<keyof ColumnMap, string[]> = {
  store: ["loja", "unidade", "filial", "restaurante", "store", "ponto de venda", "pdv", "estabelecimento", "sigla"],
  month: ["mes", "mês", "periodo", "periodo referencia", "competencia", "data", "month", "período", "mês/ano", "mes/ano", "referencia"],
  receita: [
    "faturamento",
    "faturamento real",
    "faturamento realizado",
    "faturamento/vendas",
    "faturamento de vendas",
    "receita de vendas",
    "receita vendas",
    "vendas",
    "faturamento liquido sem taxa",
    "faturamento liquido",
    "receita",
    "fat liquido",
    "revenue",
    "sales",
  ],
  taxa: [
    "taxa de servico",
    "taxa servico",
    "taxa de serviço",
    "taxa",
    "taxa de entrega",
    "delivery fee",
    "service fee",
    "entrega",
  ],
  tc: [
    "tc — quantidade de clientes/pedidos atendidos",
    "tc - quantidade de clientes/pedidos atendidos",
    "quantidade de clientes/pedidos atendidos",
    "clientes/pedidos atendidos",
    "tc",
    "total de clientes",
    "clientes atendidos",
    "pedidos",
    "total de atendimentos",
    "total atendimentos",
    "atendimentos",
  ],
};

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
