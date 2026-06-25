import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { getPropertyFailure } from "@failures/mfe";
import { openInternalDelegationLetterPlaceholder } from "@case-study/mfe/lib/prototype/internal-delegation-letter-placeholder";
import { caseStudyWorkspacePath } from "../my-task-routes";
import {
  poPropertiesPath,
  poPropertyEditPath,
  poPropertyFailurePath,
  poPropertyPath,
} from "../po-routes";
import type { WorkflowTask } from "./tasks-storage";

export function buildActiveQueueRowMoreItems(options: {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
}): RowMoreMenuItem[] {
  const po = options.task.poNumber.trim();
  const propertyId = options.propertyId?.trim();

  const items: RowMoreMenuItem[] = [
    {
      id: "open",
      label: "فتح المعاملة",
      onClick: options.openTask,
    },
    {
      id: "po-properties",
      label: "عقارات أمر العمل",
      onClick: () => options.router.push(poPropertiesPath(po)),
    },
    {
      id: "delegation-letter",
      label: "خطاب تفويض الشركة",
      onClick: () =>
        openInternalDelegationLetterPlaceholder({
          poNumber: po,
          propertyId,
        }),
    },
  ];

  if (propertyId) {
    items.push(
      {
        id: "property-detail",
        label: "تفاصيل العقار",
        onClick: () => options.router.push(poPropertyPath(po, propertyId)),
      },
      {
        id: "property-edit",
        label: "تعديل العقار",
        onClick: () => options.router.push(poPropertyEditPath(po, propertyId)),
      },
    );
  }

  return items;
}

/** دراسة حالة العقارات — ⋮ menu */
export function buildCaseStudyQueueRowMoreItems(options: {
  task: WorkflowTask;
  propertyId?: string;
  router: { push: (href: string) => void };
}): RowMoreMenuItem[] {
  const po = options.task.poNumber.trim();
  const propertyId = options.propertyId?.trim();
  const failureExists = propertyId
    ? Boolean(getPropertyFailure(po, propertyId))
    : false;

  return [
    {
      id: "case-study",
      label: "دراسة العقار",
      onClick: () =>
        options.router.push(caseStudyWorkspacePath(options.task.id)),
    },
    {
      id: "register-failure",
      label: "تسجيل تعذر",
      danger: true,
      disabled: !propertyId || failureExists,
      onClick: () => {
        if (!propertyId) return;
        options.router.push(poPropertyFailurePath(po, propertyId));
      },
    },
    {
      id: "assign-task",
      label: "إسناد مهمة",
      onClick: () =>
        options.router.push(caseStudyWorkspacePath(options.task.id)),
    },
  ];
}
