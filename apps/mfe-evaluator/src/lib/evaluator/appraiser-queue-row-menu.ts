import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import {
  poPropertiesPath,
  poPropertyPath,
} from "@case-study/mfe/lib/po-routes";
import type { WorkflowTask } from "@case-study/mfe/lib/prototype/tasks-storage";

export function buildAppraiserQueueRowMoreItems(options: {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  refreshQueue: () => void;
}): RowMoreMenuItem[] {
  void options.refreshQueue;
  const po = options.task.poNumber.trim();
  const propertyId = options.propertyId?.trim();

  const items: RowMoreMenuItem[] = [
    {
      id: "property-data",
      label: "بيانات العقار",
      onClick: () => {
        if (po && propertyId) {
          options.router.push(poPropertyPath(po, propertyId));
          return;
        }
        options.openTask();
      },
    },
    {
      id: "open-report",
      label: "تقرير التقييم",
      onClick: options.openTask,
    },
  ];

  if (po) {
    items.push({
      id: "po-properties",
      label: "عقارات أمر العمل",
      onClick: () => options.router.push(poPropertiesPath(po)),
    });
  }

  return items;
}
