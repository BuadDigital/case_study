import type { PendingBoursePropertyDto } from "@platform/api-client";

type BourseFailureRef = {
  poNumber: string;
  propertyId: string;
  status: string;
};

/** صك بانتظار إكمال البورصة — يستثني التعذر النشط (نفس منطق قائمة استعلام بورصة). */
export function isPendingBourseActionable(
  item: Pick<PendingBoursePropertyDto, "poNumber" | "propertyId">,
  failures: readonly BourseFailureRef[],
): boolean {
  const failure = failures.find(
    (f) => f.poNumber === item.poNumber && f.propertyId === item.propertyId,
  );
  return (
    !failure ||
    failure.status === "returned" ||
    failure.status === "resolved"
  );
}

type BourseSortFields = Pick<
  PendingBoursePropertyDto,
  | "createdAtUtc"
  | "receivedFromEnfathAt"
  | "deedDate"
  | "poNumber"
  | "deedNumber"
>;

/** Newest first — same idea as البيانات الأولية (latest PO creation first). */
export function comparePendingBourseNewestFirst(
  a: BourseSortFields,
  b: BourseSortFields,
): number {
  const createdA =
    a.createdAtUtc?.trim() || a.receivedFromEnfathAt?.trim() || "";
  const createdB =
    b.createdAtUtc?.trim() || b.receivedFromEnfathAt?.trim() || "";
  if (createdA !== createdB) return createdB.localeCompare(createdA);

  const deedA = a.deedDate?.trim() || "";
  const deedB = b.deedDate?.trim() || "";
  if (deedA !== deedB) return deedB.localeCompare(deedA);

  const poCmp = a.poNumber.trim().localeCompare(b.poNumber.trim(), "ar");
  if (poCmp !== 0) return poCmp;
  return a.deedNumber.trim().localeCompare(b.deedNumber.trim(), "ar");
}

export function filterActionablePendingBourseItems<
  T extends Pick<PendingBoursePropertyDto, "poNumber" | "propertyId"> &
    BourseSortFields,
>(items: readonly T[], failures: readonly BourseFailureRef[]): T[] {
  return items
    .filter((item) => isPendingBourseActionable(item, failures))
    .sort(comparePendingBourseNewestFirst);
}
