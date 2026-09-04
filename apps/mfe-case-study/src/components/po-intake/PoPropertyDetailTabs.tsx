"use client";

/**
 * Property-detail tab chrome: the tab bar, the mobile glance, the side rail and
 * one panel per tab. Queries, tab selection and the seen-tab bookkeeping live in
 * `usePoPropertyDetailTabsWorkflow`; pure tab rules in
 * `po-property-detail-tabs-state.ts`; lazy bodies in `PropertyDetailTabChunks`.
 */

import { Activity } from "react";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  Button,
  Tab,
  TabBar,
  TabPanel,
  cn,
  opsContentPanel,
} from "@platform/ui-kit";
import { DetailBadge, EmptyState, ltrValueClass, SectionHeader } from "./PropertyDetailFields";
import { PropertyDetailBasicTab } from "./PropertyDetailBasicTab";
import { PropertyDetailSurveyNotesTab } from "./PropertyDetailSurveyNotesTab";
import { PropertyTransactionTimeline } from "./PropertyTransactionTimeline";
import { PropertyDetailMobileGlance } from "./PropertyDetailMobileGlance";
import { formatDateAr, type PoIntakeRecord, type PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import { poPropertyFailurePath } from "@platform/app-shared/domain/po-routes";
import { formatTimelineDate } from "../../lib/app-data/property-detail-timeline";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import { propertyTabHasNewDot } from "../../lib/app-data/property-detail-local-ui";
import { DocumentsTab } from "./PropertyDetailDocumentsTab";
import {
  isAllowedPropertyTab,
  logIconClass,
  logIconGlyph,
} from "./po-property-detail-tabs-state";
import {
  PartyRoleDetailPanel,
  PropertyDetailAppraisalTab,
  PropertyDetailCaseStudyReport,
  PropertyDetailEnfathUpload,
  PropertyDetailFinanceTab,
  PropertyDetailGovernmentReviewsTab,
  PropertyDetailInspectionTab,
  PropertyDetailLinkedTab,
  PropertyDetailPartyPackageReview,
  PropertyDetailPhotosTab,
  PropertyDetailPropertyKeys,
} from "./PropertyDetailTabChunks";
import { usePoPropertyDetailTabsWorkflow } from "./usePoPropertyDetailTabsWorkflow";

export type PoPropertyDetailInspectorWorkspace = {
  /** Active field-inspection task for this property (desktop HTML inspect-desktop). */
  task: WorkflowTask;
  /** Keep edit mode on (inspector workspace). Cancel calls onCancel. */
  forceEdit?: boolean;
  onSubmitted?: () => void;
  onCancel?: () => void;
};


export function PoPropertyDetailTabs({
  record,
  property,
  showDecree,
  inspectorWorkspace,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  showDecree: boolean;
  /**
   * Case Study.html `inspect-desktop`: stay on property-detail chrome with
   * property inspection in input mode. Used by /active-inspection desktop.
   */
  inspectorWorkspace?: PoPropertyDetailInspectorWorkspace;
}) {
  const {
    role,
    router,
    visibleTabs,
    showCaseStudySideRail,
    workspaceForced,
    effectiveTab,
    tabMode,
    visitedTabsRef,
    selectTab,
    replaceInspectQuery,
    inspectEdit,
    setInspectEdit,
    seenTabs,
    tabActivity,
    tasks,
    poNumber,
    task,
    failures,
    propertyFailures,
    surveyTask,
    appraisalTask,
    inspectionTask,
    propertyDocumentSections,
    propertyPhotos,
    primaryPhoto,
    appraisalCard,
    inspectionCard,
    surveyCard,
    partySubmissionsQuery,
    partyRemarksSections,
    logEvents,
    propertyFeeRows,
    keysStatus,
    keysHasData,
  } = usePoPropertyDetailTabsWorkflow({
    record,
    property,
    showDecree,
    inspectorWorkspace,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PropertyDetailMobileGlance
        poNumber={poNumber}
        property={property}
        keysStatus={keysStatus}
        keysHasData={keysHasData}
        feeRows={propertyFeeRows}
        failureCount={propertyFailures.length}
        allowedTabs={visibleTabs.map((t) => t.id)}
        onOpenTab={(next) => {
          if (!isAllowedPropertyTab(role, next)) return;
          selectTab(next);
          if (inspectEdit) {
            setInspectEdit(false);
            replaceInspectQuery(null);
          }
        }}
      />

      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 overflow-y-auto",
          showCaseStudySideRail && "lg:grid-cols-[minmax(0,1fr)_250px]",
        )}
      >
        <div className={opsContentPanel}>
          {/* Case Study.html `.tabs` inside card: margin 0 -20px, padding 0 14px, wrap, gap 2px */}
          <TabBar
            className="z-10 mx-[-20px] mb-0 flex flex-wrap gap-x-0.5 gap-y-0 overflow-visible whitespace-nowrap border-b border-border bg-transparent px-3.5 sm:px-3.5"
            aria-label="أقسام تفاصيل العقار"
          >
            {visibleTabs.map((t) => {
              const active = effectiveTab === t.id;
              const hasNew = propertyTabHasNewDot(
                t.id,
                tabActivity[t.id],
                seenTabs,
              );
              return (
                <Tab
                  key={t.id}
                  active={active}
                  onClick={() => {
                    selectTab(t.id);
                    if (workspaceForced) return;
                    /* Tab is view-only — input mode opens from the property-inspection button. */
                    if (t.id === "inspection" && inspectEdit) {
                      setInspectEdit(false);
                      replaceInspectQuery(null);
                    } else if (t.id !== "inspection" && inspectEdit) {
                      setInspectEdit(false);
                      replaceInspectQuery(null);
                    }
                  }}
                  className={cn(
                    "relative mb-0 max-lg:min-h-0 border-0 border-b-0 px-2.5 py-[9px] text-[12.5px] font-normal text-text-2",
                    "rounded-none transition-[background,color] duration-150",
                    "hover:bg-[color-mix(in_srgb,#102B4E_6%,transparent)] hover:text-heading",
                    active &&
                      "!border-0 !bg-ink !font-normal !text-white hover:!bg-ink hover:!text-white",
                    hasNew &&
                      "after:absolute after:top-1.5 after:end-[3px] after:h-[7px] after:w-[7px] after:rounded-full after:bg-[#c0392b] after:shadow-[0_0_0_2px_var(--surface,#fff)] after:content-['']",
                  )}
                >
                  {t.label}
                </Tab>
              );
            })}
          </TabBar>

          <TabPanel
            className={cn(
              "min-h-0 overflow-visible bg-transparent px-0 py-5 sm:px-0",
              effectiveTab === "appraisal" && "pt-0",
            )}
          >
          {visitedTabsRef.current.has("basic") ? (
            <Activity mode={tabMode("basic")}>
              <PropertyDetailBasicTab
                record={record}
                property={property}
                primaryPhoto={primaryPhoto}
              />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("documents") ? (
            <Activity mode={tabMode("documents")}>
              <DocumentsTab sections={propertyDocumentSections} />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("linked") ? (
            <Activity mode={tabMode("linked")}>
              <PropertyDetailLinkedTab
                record={record}
                property={property}
                caseStudyTask={task ?? null}
              />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("failures") ? (
            <Activity mode={tabMode("failures")}>
            {propertyFailures.length > 0 ? (
              <>
                <SectionHeader>التعذرات المسجلة</SectionHeader>
                {propertyFailures.map((failure: FailureRecord) => (
                  <div
                    key={failure.id}
                    className={cn(
                      "mb-1.5 flex flex-col gap-2 rounded-[var(--radius-DEFAULT)] bg-surface-2 px-3.5 py-3 border-e-[3px] sm:flex-row sm:items-start sm:justify-between sm:gap-3",
                      failure.status === "approved" ||
                        failure.status === "resolved"
                        ? "border-e-success"
                        : "border-e-warning",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 text-[13px] font-medium text-text">
                        {failure.title}
                      </div>
                      <div className="text-[11px] text-text-2">
                        سُجّل بواسطة {failure.specialist || "—"} ·{" "}
                        <bdi dir="ltr" className={ltrValueClass}>
                          {formatDateAr(failure.updatedAt.slice(0, 10))}
                        </bdi>
                        {failure.internalNote
                          ? ` · السبب: ${failure.internalNote}`
                          : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 max-lg:w-full max-lg:[&>button]:min-h-11 max-lg:[&>button]:flex-1">
                      <DetailBadge tone="amber">
                        {failureStatusLabel(failure.status)}
                      </DetailBadge>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() =>
                          router.push(
                            poPropertyFailurePath(poNumber, property.id),
                          )
                        }
                      >
                        معالجة
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="mt-3 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-4 max-lg:border-t max-lg:border-border max-lg:bg-surface/95 max-lg:px-4 max-lg:py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm">
                  <Button
                    type="button"
                    size="sm"
                    className="max-lg:min-h-11 max-lg:w-full"
                    onClick={() =>
                      router.push(poPropertyFailurePath(poNumber, property.id))
                    }
                  >
                    تسجيل تعذّر جديد
                  </Button>
                </p>
              </>
            ) : (
              <>
                <SectionHeader>التعذرات المسجلة</SectionHeader>
                <EmptyState
                  icon="⚠"
                  title="لا توجد تعذرات"
                  sub="لم يُسجَّل أي تعذر لهذا العقار."
                />
                <p className="mt-3 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-4 max-lg:border-t max-lg:border-border max-lg:bg-surface/95 max-lg:px-4 max-lg:py-3 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm">
                  <Button
                    type="button"
                    size="sm"
                    className="max-lg:min-h-11 max-lg:w-full"
                    onClick={() =>
                      router.push(poPropertyFailurePath(poNumber, property.id))
                    }
                  >
                    تسجيل تعذّر جديد
                  </Button>
                </p>
              </>
            )}
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("survey") ? (
            <Activity mode={tabMode("survey")}>
            {surveyCard ? (
              <>
                <PropertyDetailPartyPackageReview
                  taskId={surveyTask?.id}
                  submissionStatus={
                    partySubmissionsQuery.data?.survey?.packageStatus ?? "draft"
                  }
                  acceptedAtUtc={
                    partySubmissionsQuery.data?.survey?.acceptedAtUtc
                  }
                  acceptedByName={
                    partySubmissionsQuery.data?.survey?.acceptedByName
                  }
                  acceptLabel="قبول المخرجات"
                  returnPlaceholder="صف ما يجب تصحيحه في الرفع المساحي…"
                  acceptSuccessToast="تم قبول مخرجات الرفع المساحي"
                  returnSuccessToast="أُعيد الرفع المساحي للتصحيح"
                  hint="قبول المخرجات يستحق أتعاب المكتب من جدول التسعير، ويُظهر البيانات المعتمدة في حزمة إنفاذ."
                  onChanged={() => {
                    void partySubmissionsQuery.refetch();
                  }}
                />
                <PartyRoleDetailPanel
                  card={surveyCard}
                  submission={partySubmissionsQuery.data?.survey ?? null}
                  loading={
                    partySubmissionsQuery.isLoading ||
                    partySubmissionsQuery.isFetching
                  }
                />
              </>
            ) : (
              <EmptyState
                title="لم يُعيَّن طرف لهذا الدور"
                sub="سيظهر هنا الطرف وبيانات عمله بعد التعيين."
              />
            )}
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("inspection") ? (
            <Activity mode={tabMode("inspection")}>
            <PropertyDetailInspectionTab
              property={property}
              inspectionTask={inspectionTask}
              inspectionCard={inspectionCard}
              editMode={
                workspaceForced
                  ? inspectorWorkspace?.forceEdit !== false
                  : false
              }
              lockEditMode={
                workspaceForced && inspectorWorkspace?.forceEdit !== false
              }
              onEditModeChange={(edit) => {
                if (workspaceForced && !edit) {
                  inspectorWorkspace?.onCancel?.();
                  return;
                }
                if (!workspaceForced) return;
                setInspectEdit(edit);
                replaceInspectQuery(edit ? "edit" : null);
              }}
              onSubmitted={() => {
                void partySubmissionsQuery.refetch();
                inspectorWorkspace?.onSubmitted?.();
              }}
            />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("government") ? (
            <Activity mode={tabMode("government")}>
              <PropertyDetailGovernmentReviewsTab
                poNumber={poNumber}
                property={property}
              />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("report") ? (
            <Activity mode={tabMode("report")}>
              <PropertyDetailCaseStudyReport
                record={record}
                property={property}
                task={task ?? null}
              />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("appraisal") ? (
            <Activity mode={tabMode("appraisal")}>
            <PropertyDetailAppraisalTab
              propertyId={property.id}
              appraisalTaskId={appraisalTask?.id}
              appraisalCard={appraisalCard}
              submission={partySubmissionsQuery.data?.appraisal ?? null}
              onReviewChanged={() => {
                void partySubmissionsQuery.refetch();
              }}
            />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("photos") ? (
            <Activity mode={tabMode("photos")}>
              <PropertyDetailPhotosTab photos={propertyPhotos} />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("log") ? (
            <Activity mode={tabMode("log")}>
            {logEvents.length === 0 ? (
              <EmptyState title="لا يوجد سجل إجراءات" />
            ) : (
              <>
                <SectionHeader>سجل الإجراءات الكامل</SectionHeader>
                <div className="flex flex-col gap-0">
                  {logEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0"
                    >
                      <div
                        className={cn(
                          "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-sm",
                          logIconClass(),
                        )}
                        aria-hidden
                      >
                        {logIconGlyph()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 text-[13px] text-text">
                          {event.title}
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-text-2 [&>span+span]:before:mx-2 [&>span+span]:before:text-text-3 [&>span+span]:before:content-['·']">
                          <span>{formatTimelineDate(event.at)}</span>
                          {event.detail ? <span>{event.detail}</span> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("keys") ? (
            <Activity mode={tabMode("keys")}>
              <PropertyDetailPropertyKeys
                poNumber={poNumber}
                property={property}
              />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("enfath-upload") ? (
            <Activity mode={tabMode("enfath-upload")}>
            <PropertyDetailEnfathUpload
              record={record}
              property={property}
              task={task ?? null}
              parties={partySubmissionsQuery.data}
              documentSections={propertyDocumentSections}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
            />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("finance") ? (
            <Activity mode={tabMode("finance")}>
              <PropertyDetailFinanceTab
                poNumber={poNumber}
                property={property}
                tasks={tasks}
              />
            </Activity>
          ) : null}

          {visitedTabsRef.current.has("survey-notes") ? (
            <Activity mode={tabMode("survey-notes")}>
              <PropertyDetailSurveyNotesTab
                sections={partyRemarksSections}
                loading={
                  partySubmissionsQuery.isLoading ||
                  partySubmissionsQuery.isFetching
                }
              />
            </Activity>
          ) : null}
          </TabPanel>
        </div>

        {showCaseStudySideRail ? (
          <div className="sticky top-0">
            <PropertyTransactionTimeline record={record} property={property} />
          </div>
        ) : null}
      </div>
    </div>
  );
}