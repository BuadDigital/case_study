import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { openInternalDelegationLetterPlaceholder } from "@case-study/mfe/lib/prototype/internal-delegation-letter-placeholder";
import { poHeaderEditPath, poPropertiesPath } from "../po-routes";

export function buildPoListRowMoreItems(options: {
  poNumber: string;
  showEdit: boolean;
  showDelete: boolean;
  deleting: boolean;
  router: { push: (href: string) => void };
  onDelete: () => void;
}): RowMoreMenuItem[] {
  const po = options.poNumber.trim();
  const items: RowMoreMenuItem[] = [
    {
      id: "properties",
      label: "عرض العقارات",
      onClick: () => options.router.push(poPropertiesPath(po)),
    },
    {
      id: "delegation-letter",
      label: "خطاب تفويض الشركة",
      onClick: () =>
        openInternalDelegationLetterPlaceholder({ poNumber: po }),
    },
  ];

  if (options.showEdit) {
    items.push({
      id: "edit-header",
      label: "تعديل رأس أمر العمل",
      onClick: () => options.router.push(poHeaderEditPath(po)),
    });
  }

  if (options.showDelete) {
    items.push({
      id: "delete",
      label: options.deleting ? "جاري الحذف…" : "حذف أمر العمل",
      danger: true,
      disabled: options.deleting,
      onClick: options.onDelete,
    });
  }

  return items;
}
