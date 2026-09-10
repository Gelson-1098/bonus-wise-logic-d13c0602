import * as XLSX from "xlsx";
import { MONTHS } from "@/lib/format";
import { CANONICAL_STORES, type CanonicalStore } from "@/lib/official-pdf-data";
import { resolveStore, findDbStore, type ResolutionStatus } from "@/lib/store-registry";

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

export function normalizeStoreName(name: string): string {
  let s = normalize(name);
  const BRAND_RE = /^(domino'?s\s*[-–]?\s*|pizza\s*hut\s*[-–]?\s*|subway\s*[-–]?\s*|burger\s*king\s*[-–]?\s*|mc\s*donalds?\s*[-–]?\s*|kfc\s*[-–]?\s*|dex\s*[-–]?\s*)/;
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

/** Robust number parser supporting Brazilian (106.651,35) and US (106,651.35) formatting */
export function parseSmartNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  let str = String(raw).trim().replace(/r\$/i, "").replace(/\s/g, "");
  const negative = /^\(.*\)$/.test(str) || str.startsWith("-");
  str = str.replace(/[()]/g, "").replace(/^-/, "");

  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma < lastDot) {
      // US format (106,651.35) -> remove commas
      str = str.replace(/,/g, "");
    } else {
      // BR format (106.651,35) -> remove dots, replace comma with dot
      str = str.replace(/\./g, "").replace(",", ".");
    }
  } else if (str.includes(",")) {
    const parts = str.split(",");
    const p0 = parts[0] ?? "";
    const p1 = parts[1] ?? "";
    if (parts.length === 2 && p1.length === 2) {
      str = str.replace(",", ".");
    } else if (parts.length === 2 && p1.length === 3 && p0.length <= 3) {
      str = str.replace(",", "");
    } else {
      str = str.replace(",", ".");
    }
  } else if (str.includes(".")) {
    const parts = str.split(".");
    const p0 = parts[0] ?? "";
    const p1 = parts[1] ?? "";
    if (parts.length === 2 && p1.length === 3 && Number(p0) <= 100) {
      str = str.replace(".", "");
    }
  }

  const n = Number(str);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseNumber(raw: unknown): number | null {
  return parseSmartNumber(raw);
}

/** Robust month & year parser supporting serial dates, short strings ("Jun-26"), and date formats */
export function parseSmartMonthAndYear(raw: unknown, defaultYear = 2026): { month: number | null; year: number } {
  if (raw === null || raw === undefined || raw === "") return { month: null, year: defaultYear };

  if (raw instanceof Date) {
    return { month: raw.getUTCMonth() + 1, year: raw.getUTCFullYear() };
  }

  // Excel date serial number (e.g. 46174 for Jun-26)
  if (typeof raw === "number" && raw > 30000 && raw < 60000) {
    const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
    return { month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
  }

  const str = String(raw).trim();

  // Format: "Jun-26", "Jul-26", "Aug-26", "Set-26", etc.
  const shortEngMap: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    fev: 2, abr: 4, mai: 5, ago: 8, set: 9, out: 10, dez: 12,
  };

  const matchShort = str.match(/^([a-zA-Z]{3})[-/](\d{2,4})$/);
  if (matchShort && matchShort[1] && matchShort[2]) {
    const mCode = matchShort[1].toLowerCase();
    const yCode = Number(matchShort[2]);
    const m = shortEngMap[mCode] || null;
    const y = yCode < 100 ? 2000 + yCode : yCode;
    if (m) return { month: m, year: y };
  }

  // Format: "06/2026", "07/2026", "01/06/2026"
  const matchSlash = str.match(/(\d{1,2})[/-](\d{1,2})?[/-]?(\d{2,4})/);
  if (matchSlash && matchSlash[1]) {
    const p1 = Number(matchSlash[1]);
    const p2 = matchSlash[2] ? Number(matchSlash[2]) : null;
    const p3 = matchSlash[3] ? Number(matchSlash[3]) : null;

    if (p2 && p3) {
      const m = p2;
      const y = p3 < 100 ? 2000 + p3 : p3;
      if (m >= 1 && m <= 12) return { month: m, year: y };
    } else if (p2) {
      const m = p1;
      const y = p2 < 100 ? 2000 + p2 : p2;
      if (m >= 1 && m <= 12) return { month: m, year: y };
    }
  }

  // Full Portuguese name
  const norm = normalize(str);
  for (let i = 0; i < MONTHS.length; i++) {
    const mNorm = normalize(MONTHS[i]);
    if (norm.includes(mNorm) || norm.includes(mNorm.slice(0, 3))) {
      const matchY = norm.match(/202[4-9]/);
      return { month: i + 1, year: matchY ? Number(matchY[0]) : defaultYear };
    }
  }

  return { month: null, year: defaultYear };
}

export function parseMonth(raw: unknown): number | null {
  return parseSmartMonthAndYear(raw).month;
}

export function parseMonthText(text: string): number | null {
  return parseSmartMonthAndYear(text).month;
}

export function parseYearText(text: string): number | null {
  return parseSmartMonthAndYear(text).year;
}

/**
 * Identificação de loja — delega 100% para o resolvedor central
 * (`src/lib/store-registry.ts`). Nenhuma heurística local.
 */
export function resolveRowStore(
  input: { externalId?: unknown; code?: unknown; name?: unknown },
  stores: Array<{ id: string; name: string; code: string | null }> = []
): {
  status: ResolutionStatus;
  reason: string;
  canonical: CanonicalStore | null;
  dbStore: { id: string; name: string } | null;
  candidates: string[];
} {
  const res = resolveStore(input);
  const official = res.store;
  const dbMatch = official ? findDbStore(official, stores) : null;

  return {
    status: res.status,
    reason: res.reason,
    canonical: official
      ? {
          key: official.key,
          name: official.name,
          code: official.code,
          city: official.city,
          state: official.state,
          aliases: [...official.aliases, ...official.codeAliases],
        }
      : null,
    dbStore: dbMatch ? { id: dbMatch.id, name: dbMatch.name } : null,
    candidates: res.candidates.map((c) => `${c.name} (${c.code})`),
  };
}

export function matchCanonicalStore(
  rawText: unknown,
  stores: Array<{ id: string; name: string; code: string | null }> = []
): { canonical: CanonicalStore; dbStore: { id: string; name: string } | null } | null {
  const res = resolveRowStore({ name: rawText, code: rawText }, stores);
  if (res.status !== "ok" || !res.canonical) return null;
  return { canonical: res.canonical, dbStore: res.dbStore };
}

export function matchStore(
  name: string,
  stores?: Array<{ id: string; name: string; code: string | null }>
): string | null {
  const res = matchCanonicalStore(name, stores || []);
  if (!res) return null;
  return res.dbStore ? res.dbStore.id : res.canonical.name;
}

/** Master Workbook Parser: Extracts all stores, periods, revenue, and TC with zero manual work */
export function parseWorkbookAuto(
  wb: any,
  defaultYear = 2026,
  stores: Array<{ id: string; name: string; code: string | null }> = [],
  overrides: Record<string, string> = {}
): AutoImportResult {
  const allRows: AutoImportedRow[] = [];
  const detectedStores = new Set<string>();
  const unmappedStores = new Set<string>();

  if (!wb) {
    return {
      rows: [],
      detectedStoresCount: 0,
      totalRowsFound: 0,
      totalFaturamentoRealizado: 0,
      totalFaturamentoOrcado: 0,
      unmappedStores: [],
      detectedStores: [],
    };
  }

  try {
    const sheetNames = (wb.SheetNames || []) as string[];
    const xlsxLib = XLSX;

    for (const sheetName of sheetNames) {
      if (normalize(sheetName).includes("parametro") || normalize(sheetName).includes("config")) continue;

      const ws = wb.Sheets?.[sheetName];
      if (!ws) continue;

      let rawRows: unknown[][] = [];
      try {
        rawRows = (xlsxLib.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][]) || [];
      } catch (sheetErr) {
        console.warn("Erro ao ler aba:", sheetName, sheetErr);
        continue;
      }

      if (!rawRows || rawRows.length < 2) continue;

      const sheetMonthObj = parseSmartMonthAndYear(sheetName, defaultYear);

      // Find table header row
      let headerRowIdx = -1;
      let headerCols: string[] = [];

      for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;

        const nonEmpties = row.filter((c) => String(c || "").trim() !== "");
        if (nonEmpties.length < 2) continue;

        const rowText = row.map((c) => String(c || "").toLowerCase().trim()).join(" ");

        // Ignore title/metadata banners
        if (
          rowText.includes("empresa:") ||
          rowText.includes("resumo de venda") ||
          rowText.includes("periodo de:") ||
          rowText.includes("quebra por filial")
        ) {
          continue;
        }

        if (
          rowText.includes("filial") ||
          rowText.includes("loja") ||
          rowText.includes("unidade") ||
          rowText.includes("sigla") ||
          (rowText.includes("mes") && (rowText.includes("venda") || rowText.includes("faturamento") || rowText.includes("total") || rowText.includes("offline")))
        ) {
          headerRowIdx = r;
          headerCols = row.map((c) => String(c || "").trim());

          // Merge sub-headers if next row contains UF, FILIAL, NOME
          if (r + 1 < rawRows.length) {
            const nextRow = rawRows[r + 1];
            if (
              Array.isArray(nextRow) &&
              nextRow.some(
                (c) =>
                  String(c || "").toLowerCase().includes("filial") ||
                  String(c || "").toLowerCase().includes("nome") ||
                  String(c || "").toLowerCase().includes("uf")
              )
            ) {
              headerCols = headerCols.map((c, idx) => {
                const sub = String(nextRow[idx] || "").trim();
                return sub ? (c ? `${c} - ${sub}` : sub) : c;
              });
              headerRowIdx = r + 1;
            }
          }
          break;
        }
      }

      if (headerRowIdx === -1) continue;

      // Map column indices
      let filialCol = -1;
      let nomeLojaCol = -1;
      let mesCol = -1;
      let fatRealCol = -1;
      let fatOrcadoCol = -1;
      let fatBaseCol = -1;
      let tcCol = -1;

      headerCols.forEach((h, idx) => {
        const nh = normalize(h);

        if (nh === "filial" || nh.includes("filial") || nh === "sigla" || nh === "codigo" || nh === "cod") {
          if (filialCol === -1 || nh === "filial") filialCol = idx;
        }

        if (nh === "nome" || nh === "loja" || nh.includes("nome") || nh.includes("loja") || nh.includes("unidade")) {
          if (nomeLojaCol === -1 || nh === "nome" || nh === "loja") nomeLojaCol = idx;
        }

        if ((nh === "mes" || nh === "periodo" || nh === "competencia" || nh === "data" || nh.startsWith("mes ")) && !nh.includes("total") && !nh.includes("faturamento")) {
          mesCol = idx;
        }

        // Faturamento Realizado (prioritizes "faturamento real", "realizado", "total do mes", "venda offline")
        if (nh.includes("faturamento real") || nh.includes("realizado") || nh.includes("total do mes") || nh.includes("venda offline")) {
          fatRealCol = idx;
        } else if (nh.includes("faturamento") && !nh.includes("meta") && !nh.includes("anterior") && !nh.includes("2025") && !nh.includes("orcado") && fatRealCol === -1) {
          fatRealCol = idx;
        }

        // Meta / Orçado
        if (
          (nh.startsWith("meta") || nh.includes("orcado") || nh.includes("orçado") || nh.includes("meta jul") || nh.includes("meta ago") || nh.includes("meta set")) &&
          !nh.includes("%") && !nh.includes("acrescimo") && !nh.includes("atingimento") && !nh.includes("diferenca") && !nh.includes("p/ meta") && !nh.includes("para meta")
        ) {
          fatOrcadoCol = idx;
        }

        // Base anterior
        if ((nh.includes("2025") || nh.includes("anterior") || nh.includes("base")) && !nh.includes("%") && !nh.includes("meta")) {
          fatBaseCol = idx;
        }

        // TC / Pedidos / Vendas
        if (nh.includes("qtd de vendas") || nh.includes("qtd. de vendas") || nh.includes("tc") || nh.includes("pedidos") || nh.includes("clientes")) {
          tcCol = idx;
        }
      });

      // Process data rows
      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        const firstCell = String(row[0] || "").trim();
        const rowText = row.map((c) => String(c || "")).join(" ");

        // Skip footnotes and totals
        if (
          normalize(rowText).includes("total de filiais") ||
          normalize(rowText).includes("resumo de venda") ||
          normalize(firstCell).includes("total") ||
          normalize(firstCell).includes("obs") ||
          normalize(firstCell).startsWith("*")
        ) {
          continue;
        }

        const filialRaw = filialCol >= 0 ? row[filialCol] : null;
        const nomeRaw = nomeLojaCol >= 0 ? row[nomeLojaCol] : null;

        const storeMatch = matchCanonicalStore(filialRaw, stores) || matchCanonicalStore(nomeRaw, stores);
        if (!storeMatch) continue;

        const rawKey = normalize(String(filialRaw || nomeRaw || ""));
        const storeIdOverride = overrides[rawKey];

        const storeId = storeIdOverride || (storeMatch.dbStore ? storeMatch.dbStore.id : null);
        const storeName = storeMatch.canonical.name;

        // Identify month and year
        const mesRaw = mesCol >= 0 ? row[mesCol] : null;
        let { month, year } = parseSmartMonthAndYear(mesRaw, defaultYear);
        if (!month && sheetMonthObj.month) {
          month = sheetMonthObj.month;
          year = sheetMonthObj.year;
        }
        if (!month) continue;

        const realFat = fatRealCol >= 0 ? parseSmartNumber(row[fatRealCol]) : null;
        const orcadoFat = fatOrcadoCol >= 0 ? parseSmartNumber(row[fatOrcadoCol]) : null;
        const baseFat = fatBaseCol >= 0 ? parseSmartNumber(row[fatBaseCol]) : null;
        const tc = tcCol >= 0 ? parseSmartNumber(row[tcCol]) : null;

        const errors: string[] = [];
        if (!storeId) {
          errors.push("Loja não cadastrada no banco de dados");
          unmappedStores.add(storeName);
        } else {
          detectedStores.add(storeName);
        }

        if (realFat === null && orcadoFat === null && baseFat === null) {
          errors.push("Faturamento ausente");
        }

        const isValid = errors.length === 0;

        allRows.push({
          id: `imp-${storeMatch.canonical.key}-${year}-${month}-${r}`,
          sourceSheet: sheetName,
          rowNumber: r + 1,
          rawStore: String(filialRaw || nomeRaw || storeName),
          storeName,
          storeId,
          canonicalKey: storeMatch.canonical.key,
          code: storeMatch.canonical.code,
          month,
          year,
          faturamentoRealizado: realFat,
          faturamentoOrcado: orcadoFat,
          faturamentoBaseAnoAnterior: baseFat,
          tc: tc ? Math.round(tc) : null,
          isValid,
          statusText: isValid ? "✓ OK" : "⚠️ Loja não identificada",
          errors,
        });
      }
    }
  } catch (err) {
    console.error("Erro no parseWorkbookAuto:", err);
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
    "faturamento", "faturamento real", "faturamento realizado", "faturamento/vendas", "faturamento de vendas",
    "receita de vendas", "receita vendas", "vendas", "faturamento liquido sem taxa", "faturamento liquido",
    "receita", "fat liquido", "revenue", "sales"
  ],
  taxa: ["taxa de servico", "taxa servico", "taxa de serviço", "taxa", "taxa de entrega", "delivery fee", "service fee", "entrega"],
  tc: ["tc — quantidade de clientes/pedidos atendidos", "tc", "total de clientes", "clientes atendidos", "pedidos", "total de atendimentos", "atendimentos"],
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
  overrides: Record<string, string>
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
