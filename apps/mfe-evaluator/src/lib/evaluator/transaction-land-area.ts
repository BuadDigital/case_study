import type { TransactionDeedDto } from "@platform/api-client";
import { parseLocaleNumber } from "@platform/app-shared/format/number";

/**
 * The land area the appraiser values for a deed's transaction: the deed's own area, or — for a
 * linked / merged transaction — the sum of its live deeds' areas.
 *
 * How it works: `linkedDeeds` are the live deeds of a transaction with two or more
 * (`linkedPropertyDeeds` / `useLinkedPropertyDeeds`); their areas are read with `parseLocaleNumber`
 * (Arabic digits, thousands separators) and added up. Fewer than two deeds → the deed's own area as
 * it was given.
 *
 * Edge cases: fixed 2026-11-04 (A→Z #38): a transaction of two merged deeds (450 + 300 m²) valued
 * its land on one deed only («× مساحة الأرض 450 م²») and the bank's area ratio used 450 too. A deed
 * with no readable area makes the total unknown, so the deed's own area is kept rather than a sum
 * that silently leaves a deed out.
 */
export function transactionLandArea(
  ownArea: string | null | undefined,
  linkedDeeds: readonly Pick<TransactionDeedDto, "area">[],
): string | null | undefined {
  if (linkedDeeds.length < 2) return ownArea;
  let total = 0;
  for (const deed of linkedDeeds) {
    const area = parseLocaleNumber(deed.area);
    if (!Number.isFinite(area) || area <= 0) return ownArea;
    total += area;
  }
  return String(Math.round(total * 100) / 100);
}
