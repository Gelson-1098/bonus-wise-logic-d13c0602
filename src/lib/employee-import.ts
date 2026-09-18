import { normalizeKey } from "@/lib/store-registry";

export type EmployeeImportSourceRow = {
  rowNumber: number;
  fullName: string;
  store: string;
  position: string;
  registration: string;
  cpf: string;
};

type Column = "fullName" | "store" | "position" | "registration" | "cpf";

const HEADER_ALIASES: Record<Column, string[]> = {
  fullName: ["funcionario", "colaborador", "nome", "nome completo", "empregado"],
  store: ["loja", "unidade", "filial", "estabelecimento"],
  position: ["cargo", "funcao", "posicao"],
  registration: ["matricula", "registro", "codigo funcionario", "id funcionario"],
  cpf: ["cpf", "documento"],
};

function text(value: unknown) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function columnFor(value: unknown): Column | null {
  const key = normalizeKey(value);
  for (const [column, aliases] of Object.entries(HEADER_ALIASES) as [Column, string[]][]) {
    if (aliases.includes(key)) return column;
  }
  return null;
}

function rowsFromMatrix(matrix: unknown[][], offset = 0): EmployeeImportSourceRow[] {
  const headerIndex = matrix.findIndex((row) => {
    const found = new Set(row.map(columnFor).filter(Boolean));
    return found.has("fullName") && found.has("store") && found.has("position");
  });
  if (headerIndex < 0) return [];

  const columns = new Map<Column, number>();
  matrix[headerIndex]!.forEach((cell, index) => {
    const column = columnFor(cell);
    if (column && !columns.has(column)) columns.set(column, index);
  });

  return matrix.slice(headerIndex + 1).flatMap((row, index) => {
    const read = (column: Column) => text(row[columns.get(column) ?? -1]);
    const parsed = {
      rowNumber: offset + headerIndex + index + 2,
      fullName: read("fullName"),
      store: read("store"),
      position: read("position"),
      registration: read("registration"),
      cpf: read("cpf").replace(/\D/g, ""),
    };
    return parsed.fullName || parsed.store || parsed.position ? [parsed] : [];
  });
}

async function readExcel(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
  const rows: EmployeeImportSourceRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName]!, {
      header: 1,
      defval: "",
      raw: true,
    });
    rows.push(...rowsFromMatrix(matrix));
  }
  return rows;
}

type PdfTextItem = { str: string; transform: number[] };

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return Boolean(
    item && typeof item === "object" && "str" in item && "transform" in item &&
    typeof (item as PdfTextItem).str === "string" && Array.isArray((item as PdfTextItem).transform),
  );
}

async function readPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const rows: EmployeeImportSourceRow[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const item of content.items) {
      if (isPdfTextItem(item) && item.str.trim()) items.push(item);
    }
    const lines = new Map<number, PdfTextItem[]>();
    for (const item of items) {
      const y = Math.round(item.transform[5] ?? 0);
      const currentY = [...lines.keys()].find((candidate) => Math.abs(candidate - y) <= 2) ?? y;
      lines.set(currentY, [...(lines.get(currentY) ?? []), item]);
    }
    const matrix = [...lines.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, line]) => line.sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0)).map((item) => item.str));
    rows.push(...rowsFromMatrix(matrix, rows.length));
  }
  return rows;
}

export async function readEmployeeImport(file: File): Promise<EmployeeImportSourceRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || file.type === "application/pdf") return readPdf(file);
  if (["xlsx", "xls", "csv"].includes(extension ?? "")) return readExcel(file);
  throw new Error("Formato não suportado. Envie um arquivo PDF, XLS, XLSX ou CSV.");
}
