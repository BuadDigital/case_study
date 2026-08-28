export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** DD/MM/YYYY with Western digits (0-9) for Arabic UI. */
export function formatDateAr(iso: string): string {
  if (!iso) return "—";
  const day = iso.trim().slice(0, 10);
  const parts = day.split("-").map(Number);
  if (parts.length === 3 && !parts.some((n) => Number.isNaN(n))) {
    const [y, m, d] = parts;
    return `${pad2(d)}/${pad2(m)}/${y}`;
  }
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return `${pad2(parsed.getDate())}/${pad2(parsed.getMonth() + 1)}/${parsed.getFullYear()}`;
}

/** DD/MM/YYYY من طابع زمني كامل (توقيت المتصفح) — "—" عند الغياب أو تعذّر التحليل. */
export function dmy(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
