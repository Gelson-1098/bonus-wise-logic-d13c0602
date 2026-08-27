export type OfficialPdfRecord = {
  storeName: string;
  month: number; // 6 = jun, 7 = jul, 8 = ago, 9 = set, 10 = out, 11 = nov, 12 = dez
  monthLabel: string;
  year: number; // 2025 (ano base)
  receita_vendas: number;
  taxa_servico: number;
  tc: number;
  tm: number;
};

export const OFFICIAL_PDF_STORES = [
  "ACLIMACAO",
  "SP CAMPO BELO",
  "GUARULHOS GOPOUVA",
  "SP JABAQUARA",
  "JARDIM CAMBURI",
  "PRAIA DO CANTO",
  "PINHEIROS",
  "PARQUE MANDAQUI",
  "SERRA",
  "SP VILA CLEMENTINO",
] as const;

export const OFFICIAL_PDF_DATA: OfficialPdfRecord[] = [
  // 1. ACLIMACAO
  { storeName: "ACLIMACAO", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 115019.78, taxa_servico: 0, tc: 1307, tm: 88.0 },
  { storeName: "ACLIMACAO", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 118050.90, taxa_servico: 0, tc: 1377, tm: 85.73 },
  { storeName: "ACLIMACAO", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 116590.84, taxa_servico: 0, tc: 1312, tm: 88.86 },
  { storeName: "ACLIMACAO", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 117442.35, taxa_servico: 0, tc: 1345, tm: 87.32 },
  { storeName: "ACLIMACAO", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 131067.09, taxa_servico: 0, tc: 1546, tm: 84.78 },
  { storeName: "ACLIMACAO", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 130690.73, taxa_servico: 0, tc: 1597, tm: 81.84 },
  { storeName: "ACLIMACAO", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 127745.53, taxa_servico: 0, tc: 1434, tm: 89.08 },

  // 2. SP CAMPO BELO
  { storeName: "SP CAMPO BELO", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 151991.32, taxa_servico: 0, tc: 1618, tm: 93.94 },
  { storeName: "SP CAMPO BELO", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 161846.87, taxa_servico: 0, tc: 1756, tm: 92.17 },
  { storeName: "SP CAMPO BELO", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 168461.35, taxa_servico: 0, tc: 1785, tm: 94.38 },
  { storeName: "SP CAMPO BELO", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 172222.21, taxa_servico: 0, tc: 1821, tm: 94.58 },
  { storeName: "SP CAMPO BELO", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 149292.43, taxa_servico: 0, tc: 1674, tm: 89.18 },
  { storeName: "SP CAMPO BELO", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 145002.81, taxa_servico: 0, tc: 1408, tm: 102.98 },
  { storeName: "SP CAMPO BELO", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 141600.41, taxa_servico: 0, tc: 1498, tm: 94.53 },

  // 3. GUARULHOS GOPOUVA
  { storeName: "GUARULHOS GOPOUVA", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 169936.36, taxa_servico: 0, tc: 1844, tm: 92.16 },
  { storeName: "GUARULHOS GOPOUVA", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 179158.50, taxa_servico: 0, tc: 1995, tm: 89.80 },
  { storeName: "GUARULHOS GOPOUVA", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 168788.45, taxa_servico: 0, tc: 1866, tm: 90.45 },
  { storeName: "GUARULHOS GOPOUVA", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 174754.92, taxa_servico: 0, tc: 1963, tm: 89.02 },
  { storeName: "GUARULHOS GOPOUVA", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 192680.08, taxa_servico: 0, tc: 2123, tm: 90.76 },
  { storeName: "GUARULHOS GOPOUVA", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 175339.49, taxa_servico: 0, tc: 2015, tm: 87.02 },
  { storeName: "GUARULHOS GOPOUVA", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 176735.39, taxa_servico: 0, tc: 1923, tm: 91.91 },

  // 4. SP JABAQUARA
  { storeName: "SP JABAQUARA", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 136073.06, taxa_servico: 0, tc: 1433, tm: 94.96 },
  { storeName: "SP JABAQUARA", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 130163.73, taxa_servico: 0, tc: 1475, tm: 88.25 },
  { storeName: "SP JABAQUARA", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 127714.27, taxa_servico: 0, tc: 1417, tm: 90.13 },
  { storeName: "SP JABAQUARA", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 156591.51, taxa_servico: 0, tc: 1674, tm: 93.54 },
  { storeName: "SP JABAQUARA", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 156756.57, taxa_servico: 0, tc: 1715, tm: 91.40 },
  { storeName: "SP JABAQUARA", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 137753.07, taxa_servico: 0, tc: 1575, tm: 87.46 },
  { storeName: "SP JABAQUARA", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 146403.66, taxa_servico: 0, tc: 1541, tm: 95.01 },

  // 5. JARDIM CAMBURI
  { storeName: "JARDIM CAMBURI", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 163919.80, taxa_servico: 0, tc: 1914, tm: 85.64 },
  { storeName: "JARDIM CAMBURI", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 169364.39, taxa_servico: 0, tc: 1950, tm: 86.85 },
  { storeName: "JARDIM CAMBURI", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 166130.69, taxa_servico: 0, tc: 1905, tm: 87.21 },
  { storeName: "JARDIM CAMBURI", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 149305.59, taxa_servico: 0, tc: 1729, tm: 86.35 },
  { storeName: "JARDIM CAMBURI", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 153235.15, taxa_servico: 0, tc: 1796, tm: 85.32 },
  { storeName: "JARDIM CAMBURI", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 167698.74, taxa_servico: 0, tc: 2021, tm: 82.98 },
  { storeName: "JARDIM CAMBURI", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 171535.69, taxa_servico: 0, tc: 1895, tm: 90.52 },

  // 6. PRAIA DO CANTO
  { storeName: "PRAIA DO CANTO", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 210309.70, taxa_servico: 0, tc: 2290, tm: 91.84 },
  { storeName: "PRAIA DO CANTO", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 235517.06, taxa_servico: 0, tc: 2550, tm: 92.36 },
  { storeName: "PRAIA DO CANTO", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 235297.32, taxa_servico: 0, tc: 2578, tm: 91.27 },
  { storeName: "PRAIA DO CANTO", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 219207.71, taxa_servico: 0, tc: 2359, tm: 92.92 },
  { storeName: "PRAIA DO CANTO", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 212984.30, taxa_servico: 0, tc: 2347, tm: 90.75 },
  { storeName: "PRAIA DO CANTO", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 226689.02, taxa_servico: 0, tc: 2485, tm: 91.22 },
  { storeName: "PRAIA DO CANTO", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 224229.37, taxa_servico: 0, tc: 2359, tm: 95.05 },

  // 7. PINHEIROS
  { storeName: "PINHEIROS", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 163160.88, taxa_servico: 0, tc: 1693, tm: 96.37 },
  { storeName: "PINHEIROS", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 181941.36, taxa_servico: 0, tc: 1840, tm: 98.88 },
  { storeName: "PINHEIROS", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 171386.06, taxa_servico: 0, tc: 1571, tm: 109.09 },
  { storeName: "PINHEIROS", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 142209.76, taxa_servico: 0, tc: 1455, tm: 97.74 },
  { storeName: "PINHEIROS", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 175502.55, taxa_servico: 0, tc: 1810, tm: 96.96 },
  { storeName: "PINHEIROS", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 184637.35, taxa_servico: 0, tc: 1946, tm: 94.88 },
  { storeName: "PINHEIROS", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 152654.12, taxa_servico: 0, tc: 1562, tm: 97.73 },

  // 8. PARQUE MANDAQUI
  { storeName: "PARQUE MANDAQUI", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 172856.02, taxa_servico: 0, tc: 1855, tm: 93.18 },
  { storeName: "PARQUE MANDAQUI", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 177944.64, taxa_servico: 0, tc: 1964, tm: 90.60 },
  { storeName: "PARQUE MANDAQUI", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 171111.96, taxa_servico: 0, tc: 1851, tm: 92.44 },
  { storeName: "PARQUE MANDAQUI", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 172235.97, taxa_servico: 0, tc: 1819, tm: 94.69 },
  { storeName: "PARQUE MANDAQUI", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 171124.77, taxa_servico: 0, tc: 1855, tm: 92.25 },
  { storeName: "PARQUE MANDAQUI", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 181686.24, taxa_servico: 0, tc: 2076, tm: 87.52 },
  { storeName: "PARQUE MANDAQUI", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 176873.89, taxa_servico: 0, tc: 1907, tm: 92.75 },

  // 9. SERRA
  { storeName: "SERRA", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 143608.52, taxa_servico: 0, tc: 1725, tm: 83.25 },
  { storeName: "SERRA", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 133591.87, taxa_servico: 0, tc: 1574, tm: 84.87 },
  { storeName: "SERRA", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 129594.72, taxa_servico: 0, tc: 1502, tm: 86.28 },
  { storeName: "SERRA", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 130623.61, taxa_servico: 0, tc: 1514, tm: 86.28 },
  { storeName: "SERRA", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 136135.08, taxa_servico: 0, tc: 1523, tm: 89.39 },
  { storeName: "SERRA", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 140934.59, taxa_servico: 0, tc: 1612, tm: 87.43 },
  { storeName: "SERRA", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 127955.41, taxa_servico: 0, tc: 1378, tm: 92.86 },

  // 10. SP VILA CLEMENTINO
  { storeName: "SP VILA CLEMENTINO", month: 6, monthLabel: "jun/25", year: 2025, receita_vendas: 247205.87, taxa_servico: 0, tc: 2648, tm: 93.36 },
  { storeName: "SP VILA CLEMENTINO", month: 7, monthLabel: "jul/25", year: 2025, receita_vendas: 245580.04, taxa_servico: 0, tc: 2671, tm: 91.94 },
  { storeName: "SP VILA CLEMENTINO", month: 8, monthLabel: "ago/25", year: 2025, receita_vendas: 240756.19, taxa_servico: 0, tc: 2548, tm: 94.49 },
  { storeName: "SP VILA CLEMENTINO", month: 9, monthLabel: "set/25", year: 2025, receita_vendas: 256171.41, taxa_servico: 0, tc: 2712, tm: 94.46 },
  { storeName: "SP VILA CLEMENTINO", month: 10, monthLabel: "out/25", year: 2025, receita_vendas: 261293.75, taxa_servico: 0, tc: 2770, tm: 94.33 },
  { storeName: "SP VILA CLEMENTINO", month: 11, monthLabel: "nov/25", year: 2025, receita_vendas: 250885.97, taxa_servico: 0, tc: 2917, tm: 86.01 },
  { storeName: "SP VILA CLEMENTINO", month: 12, monthLabel: "dez/25", year: 2025, receita_vendas: 198529.20, taxa_servico: 0, tc: 2152, tm: 92.25 },
];
