/**
 * Normalize deed / real-estate registration numbers for prior-lookup matching.
 * Maps Arabic-Indic digits to ASCII and strips common separators.
 */
export function normalizeDeedNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  let out = "";
  for (const ch of raw.trim()) {
    if (ch >= "٠" && ch <= "٩") {
      out += String.fromCharCode("0".charCodeAt(0) + (ch.charCodeAt(0) - "٠".charCodeAt(0)));
      continue;
    }
    if (ch >= "۰" && ch <= "۹") {
      out += String.fromCharCode("0".charCodeAt(0) + (ch.charCodeAt(0) - "۰".charCodeAt(0)));
      continue;
    }
    if (
      /\s/.test(ch) ||
      ch === "-" ||
      ch === "_" ||
      ch === "/" ||
      ch === "\\" ||
      ch === "\u00A0" ||
      ch === "\u200f" ||
      ch === "\u200e"
    ) {
      continue;
    }
    out += ch;
  }
  return out;
}

export function deedsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeDeedNumber(a);
  const nb = normalizeDeedNumber(b);
  if (!na || !nb) return false;
  return na.localeCompare(nb, undefined, { sensitivity: "accent" }) === 0;
}
