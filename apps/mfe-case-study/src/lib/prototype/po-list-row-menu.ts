import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import type { PoListStatus } from "@platform/app-shared/prototype/po-list-status";
import { poHeaderEditPath, poPropertiesPath } from "../po-routes";

export function buildPoListRowMoreItems(options: {
  poNumber: string;
  status: PoListStatus;
  showEdit: boolean;
  showDelete: boolean;
  showLifecycleActions: boolean;
  deleting: boolean;
  lifecycleBusy: boolean;
  router: { push: (href: string) => void };
  onDelete: () => void;
  onCancel: () => void;
  onStop: () => void;
}): RowMoreMenuItem[] {
  const po = options.poNumber.trim();
  const items: RowMoreMenuItem[] = [
    {
      id: "properties",
      label: "عرض العقارات",
      onClick: () => options.router.push(poPropertiesPath(po)),
    },
  ];

  if (options.showEdit) {
    items.push({
      id: "edit-header",
      label: "تعديل رأس أمر العمل",
      onClick: () => options.router.push(poHeaderEditPath(po)),
    });
  }

  if (options.showLifecycleActions) {
    const cancelled = options.status === "cancelled";
    const stopped = options.status === "stopped";
    items.push({
      id: "cancel-po",
      label: options.lifecycleBusy ? "جاري الإلغاء..." : "إلغاء أمر العمل",
      danger: true,
      disabled: options.lifecycleBusy || cancelled,
      onClick: options.onCancel,
    });
    items.push({
      id: "stop-po",
      label: options.lifecycleBusy ? "جاري الإيقاف..." : "إيقاف أمر العمل",
      danger: true,
      disabled: options.lifecycleBusy || cancelled || stopped,
      onClick: options.onStop,
    });
  }

  if (options.showDelete) {
    items.push({
      id: "delete",
      label: options.deleting ? "جاري الحذف..." : "حذف أمر العمل",
      danger: true,
      disabled: options.deleting || options.lifecycleBusy,
      onClick: options.onDelete,
    });
  }

  return items;
}
