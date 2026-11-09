"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Button,
  cn,
  RowMoreMenu,
  useDeferredVisible,
  useToast,
  type RowMoreMenuItem,
  ICON_PATHS,
} from "@platform/ui-kit";
import type { RoleId } from "@platform/types";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { FAILURE_RAISER_LABEL_BY_KIND } from "@failures/mfe/lib/failure-party-roles";
import {
  canEditPropertyData,
  canRaisePropertyFailure,
  canReopenTransaction,
} from "../../lib/app-data/po-roles";
import {
  poPropertyDetailPath,
  poPropertyEditPath,
  poPropertyPath,
  poPropertyCoordinationPath,
  poPropertyWorkPath,
} from "@platform/app-shared/domain/po-routes";
import { canAccessPathname } from "@platform/app-shared/app-data/page-access";
import {
  activeSurveyWorkspacePath,
  caseStudyWorkspacePath,
  propertyAppraisalWorkspacePath,
} from "../../lib/my-task-routes";
import {
  caseStudyTaskForProperty,
  tasksForRole,
} from "../../lib/app-data/tasks";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import { canOpenCaseStudyWorkspace } from "../../lib/app-data/viewer-task-access";
import { canManageOperationsTasks } from "../../lib/app-data/operations-task-roles";
import { formatPropertyDeedDisplay } from "../../lib/app-data/po-intake-data";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "../../query/case-study-queries";
import { useTransactionCancellationQuery } from "../../query/use-transaction-cancellation-query";
import { useTransactionStateQuery } from "../../query/use-transaction-state-query";
import { useTransactionGeneralActions } from "./useTransactionGeneralActions";
import { isAllowedPropertyTab } from "./po-property-detail-tabs-state";
import {
  buildPropertyDetailHeroMenuItems,
  CASE_STUDY_OPEN_PROGRESS_MESSAGE,
} from "./property-detail-hero-menu";

const shellBtn = (variant: "default" | "primary" = "default") =>
  cn(
    "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid px-2.5 py-1.5 text-xs font-normal no-underline transition-[background,border-color] duration-150 sm:whitespace-nowrap",
    "max-lg:min-h-11 max-lg:flex-1 max-lg:px-3 max-lg:text-[13px] max-lg:font-semibold",
    variant === "primary"
      ? "border-primary bg-primary text-white hover:border-primary-mid hover:bg-primary-mid"
      : "border-border-md bg-surface text-text hover:bg-surface-2",
  );

/** Party viewers who raise a failure from the property screen — the label is who raised it. */
const PARTY_FAILURE_RAISER_BY_ROLE: Partial<Record<RoleId, string>> = {
  "field-inspector": FAILURE_RAISER_LABEL_BY_KIND["field-inspection"],
  "engineering-office": FAILURE_RAISER_LABEL_BY_KIND["engineering-survey"],
  "real-estate-appraiser": FAILURE_RAISER_LABEL_BY_KIND["property-appraisal"],
};

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
  const searchParams = useSearchParams();
  const { showProgressToast, dismissToast } = useToast();
  const { role, access, rolePages } = useAppAccess();
  const showEdit = canEditPropertyData(role);
  const showFailure = canRaisePropertyFailure(role);
  const canCreateOps = canManageOperationsTasks(access);
  const { data: record } = usePoRecordQuery(poNumber);
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const isHero = variant === "hero";
  const btn = shellBtn;
  const { itemsFor: generalItemsFor, dialogs: generalDialogs } =
    useTransactionGeneralActions();
  const { data: cancellation } = useTransactionCancellationQuery(propertyId);
  // «إعادة فتح المعاملة» (Omar 2026-11-05) shows once the server says the transaction may reopen.
  const { data: transactionState } = useTransactionStateQuery(record?.id ?? "", propertyId, {
    enabled: Boolean(record?.id) && canReopenTransaction(access),
  });
  const [openingCaseStudy, setOpeningCaseStudy] = useState(false);
  const [navPending, startTransition] = useTransition();
  const caseStudyToastIdRef = useRef<string | null>(null);
  const caseStudyLoading = openingCaseStudy || navPending;
  const showCaseStudyFeedback = useDeferredVisible(caseStudyLoading);

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

  // Party workspaces (hideOpenCaseStudy) already carry their own failures tab.
  const partyFailureRaiser = hideOpenCaseStudy
    ? undefined
    : PARTY_FAILURE_RAISER_BY_ROLE[role];
  const holdsPartyTask = useMemo(() => {
    if (!partyFailureRaiser || !property) return false;
    const po = poNumber.trim();
    return tasksForRole(role, tasks).some(
      (item) => item.poNumber.trim() === po && item.propertyId === property.id,
    );
  }, [partyFailureRaiser, property, poNumber, role, tasks]);

  const partyActions = useMemo((): PartyAction[] => {
    if (!property) return [];
    const children = task ? childTasksForCaseStudyParent(task.id, tasks) : [];
    const visibleTaskIds = new Set(
      tasksForRole(role, tasks).map((item) => item.id),
    );
    const oversees =
      role === "section-supervisor" ||
      role === "general-manager" ||
      role === "cdo";

    const findChild = (kind: string) =>
      children.find(
        (child) =>
          child.kind === kind && (oversees || visibleTaskIds.has(child.id)),
      );

    const inspection = findChild("field-inspection");
    const survey = findChild("engineering-survey");
    const appraisal = findChild("property-appraisal");

    if (!isHero) {
      return [inspection, survey, appraisal].filter(Boolean).map((child) => {
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

  useEffect(() => {
    return () => {
      if (caseStudyToastIdRef.current) {
        dismissToast(caseStudyToastIdRef.current);
        caseStudyToastIdRef.current = null;
      }
    };
  }, [dismissToast]);

  // The report tab is open — the button stops showing its pending state.
  if (openingCaseStudy && searchParams.get("tab") === "report") {
    setOpeningCaseStudy(false);
  }

  useEffect(() => {
    if (!showCaseStudyFeedback) {
      if (caseStudyToastIdRef.current) {
        dismissToast(caseStudyToastIdRef.current);
        caseStudyToastIdRef.current = null;
      }
      return;
    }
    if (!caseStudyToastIdRef.current) {
      caseStudyToastIdRef.current = showProgressToast(
        CASE_STUDY_OPEN_PROGRESS_MESSAGE,
      );
    }
  }, [showCaseStudyFeedback, showProgressToast, dismissToast]);

  const openCaseStudy = useCallback(
    (href: string) => {
      if (caseStudyLoading) return;
      setOpeningCaseStudy(true);
      startTransition(() => {
        router.push(href);
      });
    },
    [caseStudyLoading, router],
  );

  const heroMenuItems = useMemo((): RowMoreMenuItem[] => {
    if (!isHero) return [];
    return buildPropertyDetailHeroMenuItems({
      // Party viewers raise a failure from here; the tab bar already has دراسة العقار.
      // The work page, for the staff who may open it (the same rule as the route).
      workPageHref: canAccessPathname(
        poPropertyWorkPath(poNumber, propertyId),
        rolePages,
      )
        ? poPropertyWorkPath(poNumber, propertyId)
        : null,
      coordinationPageHref: canAccessPathname(
        poPropertyCoordinationPath(poNumber, propertyId),
        rolePages,
      )
        ? poPropertyCoordinationPath(poNumber, propertyId)
        : null,
      hideOpenCaseStudy: hideOpenCaseStudy || Boolean(partyFailureRaiser),
      caseStudyWorkspaceHref:
        showCaseStudyLink && task ? caseStudyWorkspacePath(task.id) : null,
      reportTabHref: isAllowedPropertyTab(role, "report")
        ? poPropertyDetailPath(poNumber, propertyId, "report")
        : null,
      caseStudyBusy: showCaseStudyFeedback,
      onNavigate: openCaseStudy,
      // Failure, final failure, cancellation: the same items and rules as every row's ⋮ menu.
      generalItems: property
        ? generalItemsFor({
            poNumber,
            property,
            canRaiseFailure: showFailure || holdsPartyTask,
            cancellationPending: Boolean(cancellation?.pending),
            busy: showCaseStudyFeedback,
            workOrderId: record?.id,
            reopenable: transactionState?.canReopen === true,
          })
        : [],
    });
  }, [
    generalItemsFor,
    property,
    showFailure,
    holdsPartyTask,
    cancellation?.pending,
    record?.id,
    transactionState?.canReopen,
    isHero,
    hideOpenCaseStudy,
    partyFailureRaiser,
    showCaseStudyLink,
    task,
    role,
    poNumber,
    propertyId,
    showCaseStudyFeedback,
    openCaseStudy,
    rolePages,
  ]);

  if (!record || !property) return null;

  if (isHero) {
    if (heroMenuItems.length === 0) return null;
    return (
      <>
        <RowMoreMenu
          items={heroMenuItems}
          busy={showCaseStudyFeedback}
          ariaLabel="إجراءات العقار"
          buttonClassName="border-border-md bg-surface text-text-2"
        />
        {generalDialogs}
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
        <Link href={poPropertyCoordinationPath(poNumber, propertyId, "bourse")} className={btn()}>
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
            <path d={ICON_PATHS.plus} />
          </svg>
          إنشاء مهمة
        </Link>
      ) : null}
      {generalDialogs}
    </div>
  );
}
