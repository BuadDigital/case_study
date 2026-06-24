export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string;
};

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportRowsToCsv<T>(
  filename: string,
  columns: readonly CsvColumn<T>[],
  rows: readonly T[],
): void {
  if (typeof window === "undefined") return;
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns.map((c) => escapeCsvCell(c.value(row) ?? "")).join(","),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${header}\n${body}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
