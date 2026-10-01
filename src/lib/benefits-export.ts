import * as XLSX from "xlsx";
import type { BenefitEntry } from "@/lib/benefits-types";
import { MONTHS } from "@/lib/format";

export type BenefitExportRecord = BenefitEntry & {
  storeCode: string;
  status: "Aprovado" | "Pendente";
};

function safeSheetName(value: string) {
  return value.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31);
}

function setWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
}

export function createBenefitsWorkbook(records: BenefitExportRecord[]) {
  const workbook = XLSX.utils.book_new();
  const consolidated = records.map((entry) => ({
    Mês: MONTHS[entry.month - 1] ?? entry.month,
    Ano: String(entry.year),
    Loja: entry.storeName,
    "Código da loja": entry.storeCode,
    Colaborador: entry.collaborator,
    Cargo: "",
    Período: `${String(entry.month).padStart(2, "0")}/${entry.year}`,
    "Dias trabalhados": entry.diasDevidos,
    Diárias: entry.diasDevidos,
    "Valor diário": entry.valorVr,
    "Total VR": entry.totalVr,
    "Total VT": entry.totalVt,
    "Outros valores": Number(entry.aditivoVr || 0) + Number(entry.aditivoVt || 0),
    "Total geral": entry.totalBeneficios,
    Status: entry.status,
    "Data de aprovação": "",
    "Aprovado por": "",
  }));
  const consolidatedSheet = XLSX.utils.json_to_sheet(consolidated);
  setWidths(consolidatedSheet, [14, 8, 24, 16, 28, 18, 12, 18, 12, 15, 15, 15, 18, 16, 14, 20, 20]);
  XLSX.utils.book_append_sheet(workbook, consolidatedSheet, "Consolidado");

  const grouped = new Map<string, BenefitExportRecord[]>();
  for (const record of records) grouped.set(record.storeName, [...(grouped.get(record.storeName) ?? []), record]);
  const byStoreRows = Array.from(grouped.entries()).map(([store, entries]) => ({
    Loja: store,
    Colaboradores: entries.length,
    Diárias: entries.reduce((sum, entry) => sum + Number(entry.diasDevidos || 0), 0),
    VR: entries.reduce((sum, entry) => sum + Number(entry.totalVr || 0), 0),
    VT: entries.reduce((sum, entry) => sum + Number(entry.totalVt || 0), 0),
    Outros: entries.reduce((sum, entry) => sum + Number(entry.aditivoVr || 0) + Number(entry.aditivoVt || 0), 0),
    Total: entries.reduce((sum, entry) => sum + Number(entry.totalBeneficios || 0), 0),
  }));
  const byStoreSheet = XLSX.utils.json_to_sheet(byStoreRows);
  setWidths(byStoreSheet, [26, 16, 14, 16, 16, 16, 18]);
  XLSX.utils.book_append_sheet(workbook, byStoreSheet, safeSheetName("Por Loja"));

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Resumo financeiro", "Valor"],
    ["Total de colaboradores", records.length],
    ["Total de diárias", { t: "n", f: `SUM('Por Loja'!C2:C${Math.max(2, byStoreRows.length + 1)})` }],
    ["Total VR", { t: "n", f: `SUM('Por Loja'!D2:D${Math.max(2, byStoreRows.length + 1)})` }],
    ["Total VT", { t: "n", f: `SUM('Por Loja'!E2:E${Math.max(2, byStoreRows.length + 1)})` }],
    ["Outros valores", { t: "n", f: `SUM('Por Loja'!F2:F${Math.max(2, byStoreRows.length + 1)})` }],
    ["Total geral para pagamento", { t: "n", f: `SUM('Por Loja'!G2:G${Math.max(2, byStoreRows.length + 1)})` }],
  ]);
  setWidths(summarySheet, [32, 20]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo Financeiro");

  const details = records.map((entry) => ({
    Loja: entry.storeName,
    Código: entry.storeCode,
    Colaborador: entry.collaborator,
    Competência: `${String(entry.month).padStart(2, "0")}/${entry.year}`,
    "Dias do mês": entry.diasMes,
    Folgas: entry.folgas,
    "Dias devidos": entry.diasDevidos,
    "VR diário": entry.valorVr,
    "Total VR": entry.totalVr,
    "VT diarista": entry.vtDiarista,
    "VT mensalista": entry.vtMensalista,
    "Depósito diário": entry.depositoDiario,
    "Total VT": entry.totalVt,
    "Aditivo VR": entry.aditivoVr,
    "Aditivo VT": entry.aditivoVt,
    "Total geral": entry.totalBeneficios,
    Status: entry.status,
    Observação: entry.obs,
  }));
  const detailSheet = XLSX.utils.json_to_sheet(details);
  setWidths(detailSheet, [24, 14, 28, 14, 14, 10, 14, 14, 14, 14, 16, 18, 14, 14, 14, 16, 14, 30]);
  XLSX.utils.book_append_sheet(workbook, detailSheet, "Detalhamento");
  return workbook;
}