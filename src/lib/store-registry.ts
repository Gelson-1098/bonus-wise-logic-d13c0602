/**
 * MATRIZ CANÔNICA OFICIAL DE LOJAS (PRISMA)
 * -----------------------------------------
 * Única fonte de verdade para identificar unidades em QUALQUER módulo
 * (importação, dashboard, ranking, relatórios).
 *
 * Regras rígidas:
 *  - DJABA / VGU  => EXCLUSIVAMENTE Domino's Jabaquara
 *  - DGGOP        => EXCLUSIVAMENTE Domino's Guarulhos Gopoúva
 *  - DAGUA        => EXCLUSIVAMENTE Domino's Aeroporto Guarulhos
 *  - SPL / SJABA  => Spoleto Rua Jabaquara
 *  - Texto genérico ("Rua Jabaquara", "Guarulhos") sem código/ID externo
 *    é AMBÍGUO e nunca é salvo automaticamente.
 *  - Conflito entre ID externo, código e nome é DIVERGÊNCIA e bloqueia a gravação.
 */

export type StoreBrand = "Domino's" | "Spoleto";

export type OfficialStore = {
  /** chave estável usada por dados históricos */
  key: string;
  /** nome oficial exibido */
  name: string;
  /** sigla oficial da matriz (ex.: DACLI) */
  code: string;
  /** código legado usado no cadastro atual (ex.: ACL) */
  legacyCode: string | null;
  /** ID externo do sistema de origem */
  externalId: string;
  brand: StoreBrand;
  city: string;
  state: string;
  /** siglas alternativas aceitas isoladamente */
  codeAliases: string[];
  /** nomes inequívocos (não podem apontar para duas unidades) */
  aliases: string[];
};

export const OFFICIAL_STORES: OfficialStore[] = [
  {
    key: "aclimacao",
    name: "Aclimação",
    code: "DACLI",
    legacyCode: "ACL",
    externalId: "5223",
    brand: "Domino's",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["dacli", "acl"],
    aliases: ["aclimacao", "sp aclimacao", "aclimacao sp", "dominos aclimacao"],
  },
  {
    key: "campo belo",
    name: "Campo Belo",
    code: "DCAMB",
    legacyCode: "CBL",
    externalId: "4539",
    brand: "Domino's",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["dcamb", "cbl"],
    aliases: ["campo belo", "sp campo belo", "campo belo sp", "dominos campo belo"],
  },
  {
    key: "guarulhos gopouva",
    name: "Guarulhos Gopoúva",
    code: "DGGOP",
    legacyCode: "GGP",
    externalId: "4962",
    brand: "Domino's",
    city: "Guarulhos",
    state: "SP",
    codeAliases: ["dggop", "ggp"],
    aliases: [
      "guarulhos gopouva",
      "gopouva",
      "sp guarulhos gopouva",
      "dominos guarulhos gopouva",
      "guarulhos gopouva sp",
    ],
  },
  {
    key: "jabaquara",
    name: "Jabaquara",
    code: "DJABA",
    legacyCode: null,
    externalId: "4538",
    brand: "Domino's",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["djaba", "vgu"],
    aliases: ["sp jabaquara", "jabaquara sp", "dominos jabaquara", "dominos sp jabaquara"],
  },
  {
    key: "jardim camburi",
    name: "Jardim Camburi",
    code: "DJDCA",
    legacyCode: "JCB",
    externalId: "5025",
    brand: "Domino's",
    city: "Vitória",
    state: "ES",
    codeAliases: ["djdca", "jcb"],
    aliases: ["jardim camburi", "camburi", "es jardim camburi", "dominos jardim camburi"],
  },
  {
    key: "praia do canto",
    name: "Praia do Canto",
    code: "DPCAN",
    legacyCode: "PDC",
    externalId: "5029",
    brand: "Domino's",
    city: "Vitória",
    state: "ES",
    codeAliases: ["dpcan", "pdc"],
    aliases: ["praia do canto", "es praia do canto", "dominos praia do canto"],
  },
  {
    key: "pinheiros",
    name: "Pinheiros",
    code: "DPINH",
    legacyCode: "PNH",
    externalId: "5222",
    brand: "Domino's",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["dpinh", "pnh"],
    aliases: ["pinheiros", "sp pinheiros", "pinheiros sp", "dominos pinheiros"],
  },
  {
    key: "parque mandaqui",
    name: "Parque Mandaqui",
    code: "DPQMA",
    legacyCode: "PMQ",
    externalId: "4963",
    brand: "Domino's",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["dpqma", "pmq"],
    aliases: ["parque mandaqui", "mandaqui", "sp parque mandaqui", "dominos parque mandaqui"],
  },
  {
    key: "serra",
    name: "Serra",
    code: "DSRRA",
    legacyCode: "SRR",
    externalId: "5031",
    brand: "Domino's",
    city: "Serra",
    state: "ES",
    codeAliases: ["dsrra", "srr"],
    aliases: ["serra", "es serra", "serra es", "dominos serra"],
  },
  {
    key: "vila clementino",
    name: "Vila Clementino",
    code: "DVCLE",
    legacyCode: "VCL",
    externalId: "4540",
    brand: "Domino's",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["dvcle", "vcl"],
    aliases: ["vila clementino", "clementino", "sp vila clementino", "dominos vila clementino"],
  },
  {
    key: "aeroporto guarulhos",
    name: "Aeroporto de Guarulhos",
    code: "DAGUA",
    legacyCode: "AGR",
    externalId: "6026",
    brand: "Domino's",
    city: "Guarulhos",
    state: "SP",
    codeAliases: ["dagua", "agr"],
    aliases: [
      "aeroporto de guarulhos",
      "aeroporto guarulhos",
      "guarulhos aeroporto",
      "aeroporto internacional de guarulhos",
      "gru airport",
      "aeroporto gru",
      "dominos aeroporto guarulhos",
    ],
  },
  {
    key: "spoleto",
    name: "Spoleto",
    code: "SPL",
    legacyCode: "SPL",
    externalId: "5976",
    brand: "Spoleto",
    city: "São Paulo",
    state: "SP",
    codeAliases: ["spl", "sjaba"],
    aliases: [
      "spoleto",
      "spoleto sp",
      "sp spoleto",
      "restaurante spoleto",
      "loja spoleto",
      "spoleto jabaquara",
      "spoleto rua jabaquara",
    ],
  },
];

/**
 * Textos que, isoladamente, podem designar mais de uma unidade.
 * Nunca resolvem automaticamente — exigem código/sigla ou ID externo.
 */
export const AMBIGUOUS_NAMES: Record<string, string[]> = {
  jabaquara: ["jabaquara", "spoleto"],
  "rua jabaquara": ["jabaquara", "spoleto"],
  guarulhos: ["guarulhos gopouva", "aeroporto guarulhos"],
  "sp guarulhos": ["guarulhos gopouva", "aeroporto guarulhos"],
  gru: ["aeroporto guarulhos", "guarulhos gopouva"],
};

export function normalizeKey(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripBrandAndPrefix(text: string): string {
  let s = normalizeKey(text);
  const BRAND = /^(dominos?|domino s|pizza hut|spoleto|dex)\s+[-]?\s*/;
  const UF = /^(sp|es|rj|mg|pr|sc|ba|ce|go|df|rs|pe)\s+[-]?\s*/;
  const TYPE = /^(loja|restaurante|filial|unidade|store|pdv)\s+/;
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(TYPE, "").trim();
  }
  return s.replace(UF, "").trim();
}

const NON_STORE_TOKENS = [
  "resumo de venda",
  "resumo",
  "periodo de",
  "quebra por filial",
  "empresa",
  "unidade",
  "filial",
  "total de filiais",
  "total",
  "consolidado",
  "ticket medio",
  "desconsideradas",
  "observacao",
  "obs",
  "produtos por atendimento",
  "venda offline",
  "faturamento",
  "status",
  "nome",
];

export type ResolutionStatus = "ok" | "ambiguous" | "divergent" | "unknown";

export type StoreResolution = {
  status: ResolutionStatus;
  store: OfficialStore | null;
  /** candidatos quando ambíguo/divergente */
  candidates: OfficialStore[];
  /** explicação legível do que aconteceu */
  reason: string;
  /** sinais usados na decisão */
  signals: { externalId: string | null; code: string | null; name: string | null };
};

function byExternalId(value: unknown): OfficialStore | null {
  const v = normalizeKey(value).replace(/\s/g, "");
  if (!v || !/^\d{3,8}$/.test(v)) return null;
  return OFFICIAL_STORES.find((s) => s.externalId === v) ?? null;
}

function byCode(value: unknown): OfficialStore | null {
  const v = normalizeKey(value).replace(/\s/g, "");
  if (!v || v.length < 3) return null;
  return (
    OFFICIAL_STORES.find(
      (s) => normalizeKey(s.code).replace(/\s/g, "") === v || s.codeAliases.some((c) => normalizeKey(c).replace(/\s/g, "") === v),
    ) ?? null
  );
}

/** Resolve pelo nome. Retorna lista de candidatos (0, 1 ou mais). */
function byName(value: unknown): OfficialStore[] {
  const raw = normalizeKey(value);
  if (!raw) return [];
  if (NON_STORE_TOKENS.includes(raw)) return [];

  const clean = stripBrandAndPrefix(raw);

  // 1. Ambiguidade explícita
  const ambiguous = AMBIGUOUS_NAMES[raw] ?? AMBIGUOUS_NAMES[clean];
  if (ambiguous) {
    return ambiguous
      .map((k) => OFFICIAL_STORES.find((s) => s.key === k))
      .filter((s): s is OfficialStore => Boolean(s));
  }

  // 2. Match exato por nome/chave/alias
  const exact = OFFICIAL_STORES.filter(
    (s) =>
      normalizeKey(s.name) === raw ||
      s.key === raw ||
      s.aliases.some((a) => normalizeKey(a) === raw) ||
      normalizeKey(s.name) === clean ||
      s.key === clean ||
      s.aliases.some((a) => normalizeKey(a) === clean),
  );
  if (exact.length > 0) return exact;

  // 3. Contenção controlada (mínimo 5 caracteres, sem heurística de token único)
  if (clean.length >= 5) {
    const partial = OFFICIAL_STORES.filter((s) => {
      const candidates = [normalizeKey(s.name), s.key, ...s.aliases.map(normalizeKey)];
      return candidates.some((c) => c.length >= 5 && (c === clean || clean.includes(c)));
    });
    if (partial.length > 0) return partial;
  }

  return [];
}

/**
 * Identificação canônica considerando o CONJUNTO de informações:
 * ID externo + código/sigla + nome da filial.
 */
export function resolveStore(input: {
  externalId?: unknown;
  code?: unknown;
  name?: unknown;
}): StoreResolution {
  const byId = byExternalId(input.externalId);
  const byCod = byCode(input.code) ?? byCode(input.name);
  const nameCandidates = byName(input.name);
  const nameCandidatesFromCode = byName(input.code);
  const names = nameCandidates.length > 0 ? nameCandidates : nameCandidatesFromCode;

  const signals = {
    externalId: input.externalId != null ? String(input.externalId) : null,
    code: input.code != null ? String(input.code) : null,
    name: input.name != null ? String(input.name) : null,
  };

  const strong: Array<{ label: string; store: OfficialStore }> = [];
  if (byId) strong.push({ label: `ID externo ${byId.externalId}`, store: byId });
  if (byCod) strong.push({ label: `código ${byCod.code}`, store: byCod });

  // Divergência entre sinais fortes
  if (strong.length === 2 && strong[0]!.store.key !== strong[1]!.store.key) {
    return {
      status: "divergent",
      store: null,
      candidates: strong.map((s) => s.store),
      reason: `DIVERGÊNCIA: ${strong[0]!.label} aponta para ${strong[0]!.store.name}, mas ${strong[1]!.label} aponta para ${strong[1]!.store.name}.`,
      signals,
    };
  }

  const resolvedStrong = strong[0]?.store ?? null;

  // Divergência entre sinal forte e nome inequívoco
  if (resolvedStrong && names.length === 1 && names[0]!.key !== resolvedStrong.key) {
    return {
      status: "divergent",
      store: null,
      candidates: [resolvedStrong, names[0]!],
      reason: `DIVERGÊNCIA: ${strong[0]!.label} aponta para ${resolvedStrong.name}, mas o nome "${String(input.name ?? "")}" corresponde a ${names[0]!.name}.`,
      signals,
    };
  }

  if (resolvedStrong) {
    return {
      status: "ok",
      store: resolvedStrong,
      candidates: [resolvedStrong],
      reason: `Identificada por ${strong.map((s) => s.label).join(" + ")}.`,
      signals,
    };
  }

  if (names.length === 1) {
    return {
      status: "ok",
      store: names[0]!,
      candidates: names,
      reason: `Identificada pelo nome da filial (${names[0]!.name}).`,
      signals,
    };
  }

  if (names.length > 1) {
    return {
      status: "ambiguous",
      store: null,
      candidates: names,
      reason: `AMBÍGUO: "${String(input.name ?? input.code ?? "")}" pode ser ${names
        .map((s) => `${s.name} (${s.code})`)
        .join(" ou ")}. Informe o código/sigla ou o ID externo.`,
      signals,
    };
  }

  return {
    status: "unknown",
    store: null,
    candidates: [],
    reason: "Unidade não encontrada na matriz oficial.",
    signals,
  };
}

/** Encontra a loja cadastrada no banco correspondente a uma unidade oficial. */
export function findDbStore<T extends { id: string; name: string; code: string | null }>(
  official: OfficialStore,
  stores: T[],
): T | null {
  const wantedCodes = [official.code, official.legacyCode, ...official.codeAliases]
    .filter(Boolean)
    .map((c) => normalizeKey(c).replace(/\s/g, ""));

  const byCodeMatch = stores.find(
    (s) => s.code && wantedCodes.includes(normalizeKey(s.code).replace(/\s/g, "")),
  );
  if (byCodeMatch) return byCodeMatch;

  const byNameMatch = stores.find(
    (s) => normalizeKey(s.name) === normalizeKey(official.name) || normalizeKey(s.name) === official.key,
  );
  return byNameMatch ?? null;
}

export const OFFICIAL_STORE_KEYS = OFFICIAL_STORES.map((s) => s.key);
