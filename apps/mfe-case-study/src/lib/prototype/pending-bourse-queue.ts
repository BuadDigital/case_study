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

export function filterActionablePendingBourseItems<
  T extends Pick<PendingBoursePropertyDto, "poNumber" | "propertyId">,
>(items: readonly T[], failures: readonly BourseFailureRef[]): T[] {
  return items.filter((item) => isPendingBourseActionable(item, failures));
}
