import type { RowMoreMenuItem } from "@case-study/mfe/components/ui/RowMoreMenu";
import { getPropertyFailure } from "@failures/mfe";
import { activeSurveyEntryPath, caseStudyWorkspacePath } from "../my-task-routes";
import {
  poPropertyFailurePath,
  poPropertyPath,
} from "../po-routes";
import { skipsBourseForIdentifier } from "./po-intake-data";
import {
  deletePrimaryDataTransaction,
  revertTaskToPhase,
  type WorkflowTask,
} from "./tasks-storage";
import { canDeleteTransaction } from "./po-roles";
import type { RoleId } from "@platform/types";

export type ActiveQueueRowMoreOptions = {
  task: WorkflowTask;
  propertyId?: string;
  openTask: () => void;
  router: { push: (href: string) => void };
  refreshQueue?: () => void;
  showToast?: (message: string, tone?: "success" | "error" | "info") => void;
  /** Show phase-revert actions for distribution / bourse queues. */
  allowPhaseRevert?: boolean;
  /** When true, hide «إرجاع لاستعلام البورصة» (e.g. real_estate_reg). */
  skipsBourse?: boolean;
  /** Open «نسخ من معاملة سابقة» with this row as the fixed target. */
  onCopyFromPrior?: () => void;
  /** Show «حذف المعاملة» when the queue enables it (still gated by role). */
  allowDeleteTransaction?: boolean;
  /** Viewer role — delete is supervisor / admin only. */
  viewerRole?: RoleId;
};

async function runPhaseRevert(
  options: ActiveQueueRowMoreOptions,
  targetPhase: "enfath" | "bourse",
  confirmMessage: string,
  successMessage: string,
): Promise<void> {
  if (!window.confirm(confirmMessage)) return;
  const result = await revertTaskToPhase(options.task.id, targetPhase);
  if (!result.ok) {
    options.showToast?.(result.error, "error");
    return;
  }
  options.showToast?.(successMessage, "success");
  options.refreshQueue?.();
}

function appendPhaseRevertItems(
  items: RowMoreMenuItem[],
  options: ActiveQueueRowMoreOptions,
): void {
  if (!options.allowPhaseRevert) return;
  const phase = options.task.phase;

  if (phase === "distribution") {
    if (!options.skipsBourse) {
      items.push({
        id: "revert-bourse",
        label: "إرجاع لاستعلام البورصة",
        onClick: () => {
          void runPhaseRevert(
            options,
            "bourse",
            "إرجاع المعاملة لاستعلام البورصة؟ يمكن تعديل بيانات البورصة ثم المتابعة مجددًا.",
            "تم إرجاع المعاملة لاستعلام البورصة",
          );
        },
      });
    }
  }

  if (phase === "bourse") {
    items.push({
      id: "revert-enfath",
      label: "إرجاع للبيانات الأولية",
      onClick: () => {
        void runPhaseRevert(
          options,
          "enfath",
          "إرجاع المعاملة للبيانات الأولية؟ يمكن تعديل بيانات إنفاذ ثم المتابعة مجددًا.",
          "تم إرجاع المعاملة للبيانات الأولية",
        );
      },
    });
  }
}

export function buildActiveQueueRowMoreItems(
  options: ActiveQueueRowMoreOptions,
): RowMoreMenuItem[] {
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

  if (options.onCopyFromPrior) {
    items.push({
      id: "copy-from-prior",
      label: "نسخ من معاملة سابقة",
      onClick: options.onCopyFromPrior,
    });
  }

  if (
    options.allowDeleteTransaction &&
    options.viewerRole &&
    canDeleteTransaction(options.viewerRole)
  ) {
    items.push({
      id: "delete-transaction",
      label: "حذف المعاملة",
      danger: true,
      onClick: () => {
        void (async () => {
          const reason = window.prompt("سبب الحذف (مطلوب):");
          if (reason == null) return;
          const trimmed = reason.trim();
          if (!trimmed) {
            options.showToast?.("سبب الحذف مطلوب", "error");
            return;
          }
          if (
            !window.confirm(
              "حذف هذه المعاملة؟ يبقى العقار في قائمة أمر العمل مع سبب الحذف، ولا يمكن التراجع.",
            )
          ) {
            return;
          }
          const result = await deletePrimaryDataTransaction(
            options.task.id,
            trimmed,
          );
          if (!result.ok) {
            options.showToast?.(result.error, "error");
            return;
          }
          options.showToast?.("تم حذف المعاملة", "success");
          options.refreshQueue?.();
        })();
      },
    });
  }

  if (options.task.kind === "engineering-survey") {
    items.push({
      id: "start-survey",
      label: "ابدأ الرفع المساحي",
      onClick: () => options.router.push(activeSurveyEntryPath(options.task.id)),
    });
  }

  if (
    (options.task.kind === "engineering-survey" ||
      options.task.kind === "field-inspection" ||
      options.task.kind === "property-appraisal") &&
    propertyId
  ) {
    items.push({
      id: "register-failure",
      label: "تسجيل تعذر",
      danger: true,
      disabled: failureExists,
      onClick: () => {
        options.router.push(poPropertyFailurePath(po, propertyId));
      },
    });
  }

  appendPhaseRevertItems(items, options);

  if (propertyId) {
    items.push({
      id: "property-detail",
      label: "تفاصيل العقار",
      onClick: () => options.router.push(poPropertyPath(po, propertyId)),
    });
  }

  return items;
}

export function buildDistributionQueueRowMoreItems(
  options: ActiveQueueRowMoreOptions & {
    identifierType?: string;
  },
): RowMoreMenuItem[] {
  return buildActiveQueueRowMoreItems({
    ...options,
    allowPhaseRevert: true,
    skipsBourse:
      options.skipsBourse ??
      (options.identifierType
        ? skipsBourseForIdentifier(
            options.identifierType as Parameters<
              typeof skipsBourseForIdentifier
            >[0],
          )
        : false),
  });
}

export function buildBourseQueueRowMoreItems(
  options: ActiveQueueRowMoreOptions,
): RowMoreMenuItem[] {
  return buildActiveQueueRowMoreItems({
    ...options,
    allowPhaseRevert: true,
  });
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
