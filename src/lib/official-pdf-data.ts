export type OfficialPdfRecord = {
  storeName: string;
  canonicalKey: string;
  month: number; // 6 = jun, 7 = jul, 8 = ago, 9 = set, 10 = out, 11 = nov, 12 = dez
  monthLabel: string;
  year: number; // 2025 (ano base)
  receita_vendas: number;
  taxa_servico: number;
  tc: number;
  tm: number;
};

export type CanonicalStore = {
  key: string;
  name: string;
  code: string;
  city: string;
  state: string;
  aliases: string[];
};

export const CANONICAL_STORES: CanonicalStore[] = [
  {
    key: "aclimacao",
    name: "Aclimação",
    code: "ACL",
    city: "São Paulo",
    state: "SP",
    aliases: ["aclimacao", "aclimação", "loja aclimacao", "sp aclimacao", "aclimacao sp"],
  },
  {
    key: "campo belo",
    name: "Campo Belo",
    code: "CBL",
    city: "São Paulo",
    state: "SP",
    aliases: ["campo belo", "sp campo belo", "campo belo sp"],
  },
  {
    key: "guarulhos gopouva",
    name: "Guarulhos Gopoúva",
    code: "GGP",
    city: "Guarulhos",
    state: "SP",
    aliases: ["guarulhos gopouva", "guarulhos gopoúva", "guarulhos", "gopouva"],
  },
  {
    key: "jabaquara",
    name: "Jabaquara",
    code: "JBQ",
    city: "São Paulo",
    state: "SP",
    aliases: ["jabaquara", "sp jabaquara", "spoleto jabaquara", "jabaquara sp"],
  },
  {
    key: "jardim camburi",
    name: "Jardim Camburi",
    code: "JCB",
    city: "Vitória",
    state: "ES",
    aliases: ["jardim camburi", "camburi", "es jardim camburi"],
  },
  {
    key: "praia do canto",
    name: "Praia do Canto",
    code: "PDC",
    city: "Vitória",
    state: "ES",
    aliases: ["praia do canto", "canto", "es praia do canto"],
  },
  {
    key: "pinheiros",
    name: "Pinheiros",
    code: "PNH",
    city: "São Paulo",
    state: "SP",
    aliases: ["pinheiros", "sp pinheiros", "pinheiros sp"],
  },
  {
    key: "parque mandaqui",
    name: "Parque Mandaqui",
    code: "PMQ",
    city: "São Paulo",
    state: "SP",
    aliases: ["parque mandaqui", "mandaqui", "sp parque mandaqui"],
  },
  {
    key: "serra",
    name: "Serra",
    code: "SRR",
    city: "Serra",
    state: "ES",
    aliases: ["serra", "es serra", "serra es"],
  },
  {
    key: "vila clementino",
    name: "Vila Clementino",
    code: "VCL",
    city: "São Paulo",
    state: "SP",
    aliases: ["vila clementino", "sp vila clementino", "clementino", "vila clementino sp"],
  },
  {
    key: "spoleto",
    name: "Spoleto",
    code: "SPL",
    city: "São Paulo",
    state: "SP",
    aliases: ["spoleto", "spoleto sp", "sp spoleto", "restaurante spoleto", "loja spoleto"],
  },
  {
    key: "aeroporto guarulhos",
    name: "Aeroporto de Guarulhos",
    code: "AGR",
    city: "Guarulhos",
    state: "SP",
    aliases: [
      "aeroporto de guarulhos",
      "aeroporto guarulhos",
      "guarulhos aeroporto",
      "aeroporto internacional de guarulhos",
      "gru",
      "gru airport",
      "aeroporto gru",
      "dominos gru",
      "domino s gru",
    ],
  },
];

export const OFFICIAL_PDF_STORES = CANONICAL_STORES.map((s) => s.name);

export const OFFICIAL_PDF_DATA: OfficialPdfRecord[] = [
  // 1. Aclimação
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 115019.78, taxa_servico: 0, tc: 1307, tm: 88.0 },
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 118050.90, taxa_servico: 0, tc: 1377, tm: 85.73 },
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 116590.84, taxa_servico: 0, tc: 1312, tm: 88.86 },
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 117442.35, taxa_servico: 0, tc: 1345, tm: 87.32 },
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 131067.09, taxa_servico: 0, tc: 1546, tm: 84.78 },
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 130690.73, taxa_servico: 0, tc: 1597, tm: 81.84 },
  { storeName: "Aclimação", canonicalKey: "aclimacao", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 127745.53, taxa_servico: 0, tc: 1434, tm: 89.08 },

  // 2. Campo Belo
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 151991.32, taxa_servico: 0, tc: 1618, tm: 93.94 },
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 161846.87, taxa_servico: 0, tc: 1756, tm: 92.17 },
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 168461.35, taxa_servico: 0, tc: 1785, tm: 94.38 },
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 172222.21, taxa_servico: 0, tc: 1821, tm: 94.58 },
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 149292.43, taxa_servico: 0, tc: 1674, tm: 89.18 },
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 145002.81, taxa_servico: 0, tc: 1408, tm: 102.98 },
  { storeName: "Campo Belo", canonicalKey: "campo belo", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 141600.41, taxa_servico: 0, tc: 1498, tm: 94.53 },

  // 3. Guarulhos Gopoúva
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 169936.36, taxa_servico: 0, tc: 1844, tm: 92.16 },
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 179158.50, taxa_servico: 0, tc: 1995, tm: 89.80 },
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 168788.45, taxa_servico: 0, tc: 1866, tm: 90.45 },
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 174754.92, taxa_servico: 0, tc: 1963, tm: 89.02 },
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 192680.08, taxa_servico: 0, tc: 2123, tm: 90.76 },
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 175339.49, taxa_servico: 0, tc: 2015, tm: 87.02 },
  { storeName: "Guarulhos Gopoúva", canonicalKey: "guarulhos gopouva", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 176735.39, taxa_servico: 0, tc: 1923, tm: 91.91 },

  // 4. Jabaquara
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 136073.06, taxa_servico: 0, tc: 1433, tm: 94.96 },
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 130163.73, taxa_servico: 0, tc: 1475, tm: 88.25 },
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 127714.27, taxa_servico: 0, tc: 1417, tm: 90.13 },
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 156591.51, taxa_servico: 0, tc: 1674, tm: 93.54 },
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 156756.57, taxa_servico: 0, tc: 1715, tm: 91.40 },
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 137753.07, taxa_servico: 0, tc: 1575, tm: 87.46 },
  { storeName: "Jabaquara", canonicalKey: "jabaquara", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 146403.66, taxa_servico: 0, tc: 1541, tm: 95.01 },

  // 5. Jardim Camburi
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 163919.80, taxa_servico: 0, tc: 1914, tm: 85.64 },
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 169364.39, taxa_servico: 0, tc: 1950, tm: 86.85 },
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 166130.69, taxa_servico: 0, tc: 1905, tm: 87.21 },
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 149305.59, taxa_servico: 0, tc: 1729, tm: 86.35 },
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 153235.15, taxa_servico: 0, tc: 1796, tm: 85.32 },
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 167698.74, taxa_servico: 0, tc: 2021, tm: 82.98 },
  { storeName: "Jardim Camburi", canonicalKey: "jardim camburi", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 171535.69, taxa_servico: 0, tc: 1895, tm: 90.52 },

  // 6. Praia do Canto
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 210309.70, taxa_servico: 0, tc: 2290, tm: 91.84 },
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 235517.06, taxa_servico: 0, tc: 2550, tm: 92.36 },
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 235297.32, taxa_servico: 0, tc: 2578, tm: 91.27 },
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 219207.71, taxa_servico: 0, tc: 2359, tm: 92.92 },
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 212984.30, taxa_servico: 0, tc: 2347, tm: 90.75 },
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 226689.02, taxa_servico: 0, tc: 2485, tm: 91.22 },
  { storeName: "Praia do Canto", canonicalKey: "praia do canto", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 224229.37, taxa_servico: 0, tc: 2359, tm: 95.05 },

  // 7. Pinheiros
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 163160.88, taxa_servico: 0, tc: 1693, tm: 96.37 },
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 181941.36, taxa_servico: 0, tc: 1840, tm: 98.88 },
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 171386.06, taxa_servico: 0, tc: 1571, tm: 109.09 },
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 142209.76, taxa_servico: 0, tc: 1455, tm: 97.74 },
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 175502.55, taxa_servico: 0, tc: 1810, tm: 96.96 },
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 184637.35, taxa_servico: 0, tc: 1946, tm: 94.88 },
  { storeName: "Pinheiros", canonicalKey: "pinheiros", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 152654.12, taxa_servico: 0, tc: 1562, tm: 97.73 },

  // 8. Parque Mandaqui
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 172856.02, taxa_servico: 0, tc: 1855, tm: 93.18 },
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 177944.64, taxa_servico: 0, tc: 1964, tm: 90.60 },
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 171111.96, taxa_servico: 0, tc: 1851, tm: 92.44 },
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 172235.97, taxa_servico: 0, tc: 1819, tm: 94.69 },
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 171124.77, taxa_servico: 0, tc: 1855, tm: 92.25 },
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 181686.24, taxa_servico: 0, tc: 2076, tm: 87.52 },
  { storeName: "Parque Mandaqui", canonicalKey: "parque mandaqui", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 176873.89, taxa_servico: 0, tc: 1907, tm: 92.75 },

  // 9. Serra
  { storeName: "Serra", canonicalKey: "serra", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 143608.52, taxa_servico: 0, tc: 1725, tm: 83.25 },
  { storeName: "Serra", canonicalKey: "serra", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 133591.87, taxa_servico: 0, tc: 1574, tm: 84.87 },
  { storeName: "Serra", canonicalKey: "serra", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 129594.72, taxa_servico: 0, tc: 1502, tm: 86.28 },
  { storeName: "Serra", canonicalKey: "serra", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 130623.61, taxa_servico: 0, tc: 1514, tm: 86.28 },
  { storeName: "Serra", canonicalKey: "serra", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 136135.08, taxa_servico: 0, tc: 1523, tm: 89.39 },
  { storeName: "Serra", canonicalKey: "serra", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 140934.59, taxa_servico: 0, tc: 1612, tm: 87.43 },
  { storeName: "Serra", canonicalKey: "serra", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 127955.41, taxa_servico: 0, tc: 1378, tm: 92.86 },

  // 10. Vila Clementino
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 247205.87, taxa_servico: 0, tc: 2648, tm: 93.36 },
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 245580.04, taxa_servico: 0, tc: 2671, tm: 91.94 },
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 240756.19, taxa_servico: 0, tc: 2548, tm: 94.49 },
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 256171.41, taxa_servico: 0, tc: 2712, tm: 94.46 },
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 261293.75, taxa_servico: 0, tc: 2770, tm: 94.33 },
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 250885.97, taxa_servico: 0, tc: 2917, tm: 86.01 },
  { storeName: "Vila Clementino", canonicalKey: "vila clementino", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 198529.20, taxa_servico: 0, tc: 2152, tm: 92.25 },
];
