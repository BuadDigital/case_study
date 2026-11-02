import { normalizeArabicSearchText } from "../domain/courts/circuit-search";

/** Same reach as the server's look-alike check for cities (LocationCatalogRules.SimilarEditDistance). */
const SIMILAR_EDIT_DISTANCE = 2;
const MAX_SIMILAR = 5;

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** The listed name a typed one is, whatever its hamza or ta marbuta; null when the list lacks it. */
export function listedPropertyUsage(names: readonly string[], typed: string): string | null {
  const search = normalizeArabicSearchText(typed);
  return names.find((name) => normalizeArabicSearchText(name) === search) ?? null;
}

/**
 * Listed names a typed one may mean, for «هل تقصد؟» before it joins the list as new.
 * How it works: the check runs on the phone against the list it has, so it works offline, and the name
 * goes to the server only with the inspection.
 * Edge cases: a very short name would resemble everything, so the distance never reaches half its length.
 */
export function similarPropertyUsages(names: readonly string[], typed: string): string[] {
  const search = normalizeArabicSearchText(typed);
  if (!search) return [];
  const reach = Math.min(SIMILAR_EDIT_DISTANCE, Math.floor(search.length / 2));
  return names
    .filter((name) => editDistance(normalizeArabicSearchText(name), search) <= reach)
    .slice(0, MAX_SIMILAR);
}

/** The server's rule for a new name: Arabic letters, 2–150 characters, not starting with a digit. */
export function looksLikeUsageName(typed: string): boolean {
  const name = typed.trim();
  return name.length >= 2 && name.length <= 150 && /^[\u0600-\u06FF][\u0600-\u06FF\s\d]*$/.test(name);
}
