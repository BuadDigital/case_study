"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Button,
  cn,
  RowMoreMenu,
  type RowMoreMenuItem,
} from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { ROLES } from "@platform/app-shared/app-data/constants";
import {
  FAILURE_RAISER_SPECIALIST,
  FAILURE_RAISER_SUPERVISOR,
} from "@failures/mfe/lib/failure-party-roles";
import { getPropertyFailure } from "@failures/mfe/lib/failures-repository";
import { canEditProperty, canRaisePropertyFailure } from "../../lib/app-data/po-roles";
import {
  poPropertyDetailPath,
  poPropertyEditPath,
  poPropertyPath,
} from "@platform/app-shared/domain/po-routes";
import {
  activeSurveyWorkspacePath,
  caseStudyWorkspacePath,
  propertyAppraisalWorkspacePath,
} from "../../lib/my-task-routes";
import {
  caseStudyTaskForProperty,
  tasksForRole,
} from "../../lib/app-data/tasks-storage";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import { canOpenCaseStudyWorkspace } from "../../lib/app-data/viewer-task-access";
import { canManageOperationsTasks } from "../../lib/app-data/operations-task-roles";
import { formatPropertyDeedDisplay } from "../../lib/app-data/po-intake-data";
import { usePoRecordQuery, useWorkflowTasksQuery } from "../../query/case-study-queries";
import { FailureRaiseModal } from "../failures/FailureRaiseModal";

const shellBtn = (variant: "default" | "primary" = "default") =>
  cn(
    "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid px-2.5 py-1.5 text-xs font-normal no-underline transition-[background,border-color] duration-150 sm:whitespace-nowrap",
    "max-lg:min-h-11 max-lg:flex-1 max-lg:px-3 max-lg:text-[13px] max-lg:font-semibold",
    variant === "primary"
      ? "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid"
      : "border-border-md bg-surface text-text hover:bg-surface-2",
  );

type PartyAction = {
  id: string;
  label: string;
  href?: string;
  toast?: string;
};

export function PoPropertyDetailTopbarActions({
  poNumber,
  propertyId,
  variant = "shell",
  hideOpenCaseStudy = false,
}: {
  poNumber: string;
  propertyId: string;
  variant?: "shell" | "hero";
  hideOpenCaseStudy?: boolean;
}) {
  const router = useRouter();
  const { role } = useAppAccess();
  const showEdit = canEditProperty(role);
  const showFailure = canRaisePropertyFailure(role);
  const canCreateOps = canManageOperationsTasks(role);
  const { data: record } = usePoRecordQuery(poNumber);
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const isHero = variant === "hero";
  const btn = shellBtn;
  const [failureModalOpen, setFailureModalOpen] = useState(false);

  const property = useMemo(
    () => record?.properties.find((item) => item.id === propertyId) ?? null,
    [record, propertyId],
  );

  const task = useMemo(() => {
    if (!record || !property) return null;
    return caseStudyTaskForProperty(record.poNumber.trim(), property.id, tasks);
  }, [record, property, tasks]);

  const showCaseStudyLink = useMemo(() => {
    if (!task) return false;
    return canOpenCaseStudyWorkspace(role, task, tasks);
  }, [task, role, tasks]);

  const canOpenFailureModal = Boolean(
    showFailure &&
      property &&
      !property.isRemoved &&
      !getPropertyFailure(poNumber.trim(), property.id),
  );

  const failureRaisedByRole =
    role === "section-supervisor"
      ? FAILURE_RAISER_SUPERVISOR
      : FAILURE_RAISER_SPECIALIST;
  const failureSpecialist = ROLES[role]?.name ?? "أخصائي";

  const partyActions = useMemo((): PartyAction[] => {
    if (!property) return [];
    const children = task
      ? childTasksForCaseStudyParent(task.id, tasks)
      : [];
    const visibleTaskIds = new Set(tasksForRole(role, tasks).map((item) => item.id));
    const oversees =
      role === "section-supervisor" ||
      role === "general-manager" ||
      role === "cdo";

    const findChild = (kind: string) =>
      children.find(
        (child) =>
          child.kind === kind &&
          (oversees || visibleTaskIds.has(child.id)),
      );

    const inspection = findChild("field-inspection");
    const survey = findChild("engineering-survey");
    const appraisal = findChild("property-appraisal");

    if (!isHero) {
      return [inspection, survey, appraisal]
        .filter(Boolean)
        .map((child) => {
          if (child!.kind === "field-inspection") {
            return {
              id: child!.id,
              label: "معاينة",
              href: `${poPropertyPath(poNumber, propertyId)}?tab=inspection&inspect=edit`,
            };
          }
          if (child!.kind === "engineering-survey") {
            return {
              id: child!.id,
              label: "رفع مساحي",
              href: activeSurveyWorkspacePath(child!.id),
            };
          }
          return {
            id: child!.id,
            label: "رفع تقييم",
            href: propertyAppraisalWorkspacePath(child!.id),
          };
        });
    }

    return [
      {
        id: "inspect",
        label: "معاينة العقار",
        href: inspection
          ? `${poPropertyPath(poNumber, propertyId)}?tab=inspection&inspect=edit`
          : poPropertyDetailPath(poNumber, propertyId, "inspection"),
        toast: inspection
          ? undefined
          : "مساحة عمل المعاينة — افتح التبويب أو عيّن معايناً من التوزيع.",
      },
      {
        id: "survey",
        label: "رفع التقرير المساحي",
        href: survey
          ? activeSurveyWorkspacePath(survey.id)
          : poPropertyDetailPath(poNumber, propertyId, "survey"),
        toast: survey
          ? undefined
          : "الرفع المساحي — افتح التبويب أو عيّن مكتباً هندسياً من التوزيع.",
      },
      {
        id: "appraise",
        label: "رفع تقييم",
        href: appraisal
          ? propertyAppraisalWorkspacePath(appraisal.id)
          : poPropertyDetailPath(poNumber, propertyId, "appraisal"),
        toast: appraisal
          ? undefined
          : "رفع التقييم — افتح التبويب أو عيّن مقيّماً من التوزيع.",
      },
    ];
  }, [task, tasks, role, isHero, property, poNumber, propertyId]);

  const heroMenuItems = useMemo((): RowMoreMenuItem[] => {
    if (!isHero || !canOpenFailureModal) return [];
    return [
      {
        id: "failure",
        label: "تسجيل تعذر",
        danger: true,
        onClick: () => setFailureModalOpen(true),
      },
    ];
  }, [isHero, canOpenFailureModal]);

  if (!record || !property) return null;

  const failureModal = canOpenFailureModal ? (
    <FailureRaiseModal
      open={failureModalOpen}
      onClose={() => setFailureModalOpen(false)}
      poNumber={poNumber}
      propertyId={property.id}
      deedNumber={
        formatPropertyDeedDisplay(property) || property.deedNumber.trim()
      }
      specialist={failureSpecialist}
      raisedByRole={failureRaisedByRole}
      onSubmitted={() => setFailureModalOpen(false)}
    />
  ) : null;

  if (isHero) {
    if (heroMenuItems.length === 0) return null;
    return (
      <>
        <RowMoreMenu
          items={heroMenuItems}
          ariaLabel="إجراءات العقار"
          buttonClassName="border-border-md bg-surface text-text-2"
        />
        {failureModal}
      </>
    );
  }

  const needsBourse = !property.bourseDataCompleted;
  const deedDisplay =
    formatPropertyDeedDisplay(property) || property.deedNumber.trim();
  const createTaskHref = `/operations-tasks?create=1&type=general&scope=transaction&po=${encodeURIComponent(poNumber.trim())}&deed=${encodeURIComponent(deedDisplay)}`;

  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 max-lg:w-full max-lg:[&>button]:min-h-11 max-lg:[&>button]:flex-1 max-lg:[&>a]:min-h-11 max-lg:[&>a]:flex-1"
      aria-label="إجراءات العقار"
    >
      {!hideOpenCaseStudy && showCaseStudyLink && task ? (
        <Link href={caseStudyWorkspacePath(task.id)} className={btn("primary")}>
          فتح دراسة الحالة
        </Link>
      ) : null}
      {showEdit ? (
        <Button
          type="button"
          size="sm"
          className="max-lg:min-h-11 max-lg:flex-1"
          onClick={() => router.push(poPropertyEditPath(poNumber, property.id))}
        >
          <span className="sm:hidden">تعديل</span>
          <span className="max-sm:hidden">تعديل العقار</span>
        </Button>
      ) : null}
      {partyActions.map((action) =>
        action.href ? (
          <Link key={action.id} href={action.href} className={btn()}>
            {action.label}
          </Link>
        ) : null,
      )}
      {needsBourse ? (
        <Link href="/bourse-inquiry" className={btn()}>
          <span className="sm:hidden">البورصة</span>
          <span className="max-sm:hidden">استعلام البورصة</span>
        </Link>
      ) : null}
      <Link
        href={poPropertyDetailPath(poNumber, property.id, "log")}
        className={btn()}
      >
        سجل
      </Link>
      {canCreateOps ? (
        <Link href={createTaskHref} className={btn()}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          إنشاء مهمة
        </Link>
      ) : null}
      {failureModal}
    </div>
  );
}
