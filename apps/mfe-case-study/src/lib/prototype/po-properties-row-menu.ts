import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { getPropertyFailure } from "@failures/mfe";
import type { PoPropertyIntake } from "./po-intake-data";
import {
  poPropertyEditPath,
  poPropertyFailurePath,
  poPropertyPath,
} from "../po-routes";

export type PoPropertyRowMoreContext = {
  poNumber: string;
  property: PoPropertyIntake;
  showEdit: boolean;
  showFailureRaise: boolean;
  router: { push: (href: string) => void };
  /** Open «نسخ من معاملة سابقة» with this property pre-selected. */
  onCopyFromPrior?: () => void;
};

export function buildPoPropertiesRowMoreItems(
  ctx: PoPropertyRowMoreContext,
): RowMoreMenuItem[] {
  const po = ctx.poNumber.trim();
  const propertyId = ctx.property.id;
  const items: RowMoreMenuItem[] = [
    {
      id: "property-detail",
      label: "تفاصيل العقار",
      onClick: () => ctx.router.push(poPropertyPath(po, propertyId)),
    },
  ];

  if (ctx.showEdit) {
    items.push({
      id: "property-edit",
      label: "تعديل العقار",
      onClick: () => ctx.router.push(poPropertyEditPath(po, propertyId)),
    });
    if (ctx.onCopyFromPrior) {
      items.push({
        id: "copy-from-prior",
        label: "نسخ من معاملة سابقة",
        onClick: ctx.onCopyFromPrior,
      });
    }
  }

  if (ctx.showFailureRaise && !getPropertyFailure(po, propertyId)) {
    items.push({
      id: "property-failure",
      label: "تسجيل تعذر",
      danger: true,
      onClick: () => ctx.router.push(poPropertyFailurePath(po, propertyId)),
    });
  }

  return items;
}
