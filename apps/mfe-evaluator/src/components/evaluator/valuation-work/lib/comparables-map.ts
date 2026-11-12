import type { ComparablePropertyDto } from "@platform/api-client";
import { comparableTypeLabel } from "@platform/app-shared/app-data/comparable-entry";

/**
 * The comparables the «إضافة مقارن» map may draw: the table's own ones, then the bank's (nearby, or a
 * search's hits), each once.
 *
 * Edge cases: `keep` (the land table: lands only) narrows the bank's comparables, never the
 * table's own.
 */
export function mapPickerPool(opts: {
  own: readonly ComparablePropertyDto[];
  bank: readonly ComparablePropertyDto[];
  keep?: (comparable: ComparablePropertyDto) => boolean;
}): ComparablePropertyDto[] {
  const byId = new Map<string, ComparablePropertyDto>();
  for (const comp of opts.own) byId.set(comp.id, comp);
  for (const comp of opts.bank) {
    if (byId.has(comp.id)) continue;
    if (opts.keep && !opts.keep(comp)) continue;
    byId.set(comp.id, comp);
  }
  return [...byId.values()];
}

/**
 * The property types and the usages present among `comparables`, for the map's two filter lists.
 * Types are the general ones the screens show (`comparableTypeLabel`): every land is «أرض», so
 * «أرض» and «أرض سكنية» are one choice (Omar 2026-11-12).
 */
export function comparableFilterOptions(comparables: readonly ComparablePropertyDto[]): {
  types: string[];
  usages: string[];
} {
  const distinct = (values: (string | null | undefined)[]) =>
    [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ar"),
    );
  return {
    types: distinct(comparables.map((c) => comparableTypeLabel(c.comparablePropertyType))),
    usages: distinct(comparables.map((c) => c.usage)),
  };
}

/**
 * The comparables left after the map's type and usage filters.
 *
 * Edge cases: an empty filter keeps everything; `alwaysIds` (the table's own comparables) pass
 * whatever the filters, so an adopted one never vanishes from the map.
 */
export function filterMapComparables(
  comparables: readonly ComparablePropertyDto[],
  filters: { type?: string; usage?: string; alwaysIds?: ReadonlySet<string> },
): ComparablePropertyDto[] {
  const type = filters.type?.trim() ?? "";
  const usage = filters.usage?.trim() ?? "";
  return comparables.filter(
    (c) =>
      filters.alwaysIds?.has(c.id) ||
      ((!type || comparableTypeLabel(c.comparablePropertyType) === type) &&
        (!usage || (c.usage ?? "").trim() === usage)),
  );
}
