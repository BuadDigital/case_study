import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { getPropertyFailure } from "@failures/mfe";
import { activeSurveyEntryPath, caseStudyWorkspacePath } from "../my-task-routes";
import {
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
  const failureExists = propertyId
    ? Boolean(getPropertyFailure(po, propertyId))
    : false;

  const items: RowMoreMenuItem[] = [
    {
      id: "open",
      label: "فتح المعاملة",
      onClick: options.openTask,
    },
  ];

  if (options.task.kind === "engineering-survey") {
    items.push({
      id: "start-survey",
      label: "ابدأ الرفع المساحي",
      onClick: () => options.router.push(activeSurveyEntryPath(options.task.id)),
    });
    items.push({
      id: "register-failure",
      label: "تسجيل تعذر",
      danger: true,
      disabled: !propertyId || failureExists,
      onClick: () => {
        if (!propertyId) return;
        options.router.push(poPropertyFailurePath(po, propertyId));
      },
    });
  }

  if (propertyId) {
    items.push({
      id: "property-detail",
      label: "تفاصيل العقار",
      onClick: () => options.router.push(poPropertyPath(po, propertyId)),
    });
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
