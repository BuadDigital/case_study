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

/**
 * U+200E / U+200F / U+061C — ICU puts them between the parts of an Arabic-locale date. With Latin
 * digits they split «25/10/2026» into separate runs that right-to-left text reorders
 * («2026/10/ 25»), so they are dropped from every Arabic date shown in the UI.
 */
const BIDI_MARKS = /[\u200E\u200F\u061C]/g;

/** Text from an Arabic-locale `Intl` formatter, minus the bidi marks (see `BIDI_MARKS`). */
export function stripBidiMarks(text: string): string {
  return text.replace(BIDI_MARKS, "");
}

/**
 * Arabic date/time with Latin digits (0-9), safe inside right-to-left text — `toLocaleString`
 * semantics (no options = date and time). "—" when the value is not a date.
 */
export function formatArDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale = "ar-SA-u-nu-latn",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return stripBidiMarks(d.toLocaleString(locale, options));
}

/** DD/MM/YYYY from a full timestamp (browser timezone) — "—" when absent or unparseable. */
export function dmy(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Local-calendar date YYYY-MM-DD of an instant — use instead of toISOString().slice(0, 10),
 * which takes the UTC date and lands on yesterday between midnight and 03:00 Riyadh time.
 */
export function localDateIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's local-calendar date YYYY-MM-DD. */
export function todayIso(): string {
  return localDateIso(new Date());
}

/** YYYY/MM/DD from a timestamp (browser timezone) — "—" when absent or unparseable. */
export function ymd(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}
