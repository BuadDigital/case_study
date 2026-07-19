"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  findSurveyChildForParent,
} from "@engineering-office/mfe";
import { useMemo, useState } from "react";
import {
  failuresForProperty,
  useFailuresQuery,
} from "@failures/mfe";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import type { FailureRecord } from "@failures/mfe";
import { Button, cn, Tab, TabBar, TabCount, TabPanel } from "@platform/design-system";
import {
  DetailBadge,
  DocIconButton,
  EmptyState,
  FieldBox,
  FieldsGrid,
  InfoBox,
  ltrValueClass,
  SectionDivider,
  SectionHeader,
} from "./PropertyDetailFields";
import { PropertyDetailAppraisalTab } from "./PropertyDetailAppraisalTab";
import { PropertyDetailPhotosTab } from "./PropertyDetailPhotosTab";
import { PropertyDetailLinkedTab } from "./PropertyDetailLinkedTab";
import { PropertyDetailCaseStudyReport } from "./PropertyDetailCaseStudyReport";
import { PropertyDetailPropertyKeys } from "./PropertyDetailPropertyKeys";
import { PropertyDetailEnfathUpload } from "./PropertyDetailEnfathUpload";
import { PropertyDetailFinanceTab } from "./PropertyDetailFinanceTab";
import { PropertyDetailSurveyNotesTab } from "./PropertyDetailSurveyNotesTab";
import { PropertyTransactionTimeline } from "./PropertyTransactionTimeline";
import {
  boundariesAvailabilityLabel,
  formatDateAr,
  formatPropertyBoundaryDimensionsDisplay,
  formatPropertyLandFrontagesDisplay,
  formatPropertyTypeLine,
  hasBourseDetailFields,
  ownershipStatusLabel,
  propertyLocationMapUrl,
  propertySurveyEmptyLabel,
  formatPropertyRestrictionsLine,
  showsCourtFields,
  skipsBourseForIdentifier,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { isValidContactEntry } from "../../lib/domain/po-intake/property-validation";
import { PartyRoleDetailPanel } from "./PartyRoleDetailPanel";
import {
  buildPropertyDetailPartyCards,
  partyCardDotClass,
  partyCardStatusLabel,
  type PropertyDetailPartyRoleKey,
} from "../../lib/prototype/property-detail-parties";
import { poPropertyFailurePath } from "../../lib/po-routes";
import {
  buildPropertyDetailTimeline,
  formatTimelineDate,
} from "../../lib/prototype/property-detail-timeline";
import { usePropertyTimelineQuery } from "../../query/use-property-timeline-query";
import {
  caseStudyTaskForProperty,
} from "../../lib/prototype/tasks-storage";
import { childTasksForCaseStudyParent } from "../../lib/prototype/case-study-party-answers";
import {
  countPropertyDetailDocuments,
  countPropertyDetailPhotos,
  downloadPropertyDetailDocument,
  listPropertyDetailPhotos,
  type PropertyDetailDocumentEntry,
  type PropertyDetailDocumentSection,
} from "../../lib/prototype/property-detail-documents";
import { usePropertyDetailDocuments } from "../../query/property-detail-documents-query";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { usePropertyDetailPartySubmissionsQuery } from "../../query/property-detail-party-submissions-queries";

const TABS = [
  { id: "basic", label: "البيانات الأساسية" },
  { id: "documents", label: "مستندات العقار" },
  { id: "linked", label: "العقارات المرتبطة" },
  { id: "failures", label: "التعذرات" },
  { id: "parties", label: "الأطراف" },
  { id: "report", label: "تقرير دراسة الحالة" },
  { id: "appraisal", label: "تقييم العقار" },
  { id: "photos", label: "صور العقار" },
  { id: "log", label: "السجل والتدقيق" },
  { id: "keys", label: "مفاتيح العقار" },
  { id: "enfath-upload", label: "الرفع على انفاذ" },
  { id: "finance", label: "المالية" },
  { id: "survey-notes", label: "ملاحظة" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function docIconLabel(kind: PropertyDetailDocumentEntry["kind"]): string {
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "📷";
  return "📄";
}

function DocumentRow({ doc }: { doc: PropertyDetailDocumentEntry }) {
  const canDownload = Boolean(doc.dataUrl);
  const isPdf = doc.kind === "pdf";

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-DEFAULT)] bg-surface-2 px-3 py-2.5 transition-colors hover:bg-[#eaedf2] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "min-w-7 shrink-0 text-center text-xs font-bold",
            isPdf ? "text-danger-text" : "text-success-text",
          )}
          aria-hidden
        >
          {docIconLabel(doc.kind)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-text">
            {doc.name}
          </div>
          <div className="mt-px text-[11px] text-text-2">
            <bdi dir="ltr" className={ltrValueClass}>
              {doc.fileName}
            </bdi>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <DocIconButton
          label="تحميل"
          disabled={!canDownload}
          onClick={() => downloadPropertyDetailDocument(doc)}
        />
      </div>
    </div>
  );
}

function DocumentsTab({
  sections,
}: {
  sections: PropertyDetailDocumentSection[];
}) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id} className="[&+&]:mt-5">
          <SectionHeader>{section.title}</SectionHeader>
          {section.documents.length === 0 ? (
            <InfoBox icon="ℹ">لا توجد مستندات في هذا القسم بعد.</InfoBox>
          ) : (
            <div className="mb-1 flex flex-col gap-1.5">
              {section.documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}

function logIconGlyph(tone: string): string {
  if (tone === "done") return "✓";
  if (tone === "active") return "⚠";
  if (tone === "warn") return "⚠";
  return "+";
}

function logIconClass(tone: string): string {
  if (tone === "done") return "bg-success-bg text-success-text";
  if (tone === "active") return "bg-warning-bg text-warning";
  if (tone === "warn") return "bg-danger-bg text-danger-text";
  return "bg-surface-2 text-text-2";
}

function partyDotClass(dotClass: string): string {
  if (dotClass.includes("teal")) return "bg-success";
  if (dotClass.includes("amber")) return "bg-warning";
  return "bg-text-3";
}

function BasicTab({
  record,
  property,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
}) {
  const boursePending = !property.bourseDataCompleted;
  const needsBourse = !skipsBourseForIdentifier(property.identifierType);
  const showBourseSection =
    needsBourse &&
    (boursePending ||
      hasBourseDetailFields(property) ||
      property.bourseDataCompleted);
  const validContacts = property.contacts.filter((c) => isValidContactEntry(c));
  const restrictions = formatPropertyRestrictionsLine(property);
  const courtLine = [property.court, property.circuit]
    .filter(Boolean)
    .join(" / ");
  const primaryContact = validContacts[0];
  const mapUrl = propertyLocationMapUrl(property);
  const boundaryDimensions = formatPropertyBoundaryDimensionsDisplay(property);
  const landFrontages = formatPropertyLandFrontagesDisplay(property);
  const ownershipStatus = ownershipStatusLabel(property);
  const dimensionsEmpty = propertySurveyEmptyLabel(property, "dimensions");
  const frontagesEmpty = propertySurveyEmptyLabel(property, "frontages");

  return (
    <>
      <div className="max-lg:hidden">
        <SectionHeader>بيانات الصك</SectionHeader>
        <FieldsGrid>
          <FieldBox label="رقم الصك" value={property.deedNumber} ltr />
          <FieldBox
            label="رقم التكليف"
            value={property.assignmentMandateNumber}
            ltr
          />
          <FieldBox
            label="تاريخ التكليف"
            value={property.assignmentMandateDate}
            ltr
          />
          <FieldBox label="رقم الطلب" value={property.requestNumber} ltr />
          <FieldBox label="تاريخ الصك" value={property.deedDate} ltr />
          <FieldBox label="حالة الصك">
            {property.deedStatus.trim() ? (
              <DetailBadge tone="teal">{property.deedStatus}</DetailBadge>
            ) : null}
          </FieldBox>
          <FieldBox label="اسم المالك" value={property.ownerName} />
          <FieldBox label="حالة الملك" value={ownershipStatus} />
          <FieldBox
            label="القيود على العقار"
            value={restrictions}
            emptyLabel="لا توجد قيود"
          />
        </FieldsGrid>

        <SectionDivider />
      </div>
      <SectionHeader>بيانات الموقع</SectionHeader>
      <FieldsGrid>
        <FieldBox label="المدينة" value={property.city} />
        <FieldBox label="الحي" value={property.district} />
        {showsCourtFields(record.assignmentType) ? (
          <FieldBox label="المحكمة / الدائرة" value={courtLine} />
        ) : null}
        <FieldBox label="رقم المخطط" value={property.planNumber} ltr />
        <FieldBox label="رقم القطعة" value={property.plotNumber} ltr />
        <FieldBox
          label="توفر الحدود"
          value={boundariesAvailabilityLabel(property.boundariesAvailability)}
        />
        <FieldBox
          label="رابط موقع الخريطة"
          span={2}
          href={
            property.locationMapUrl.trim() || mapUrl || undefined
          }
        >
          {property.locationMapUrl.trim()
            ? "فتح رابط الموقع"
            : mapUrl
              ? "عرض تقريبي على الخريطة"
              : undefined}
        </FieldBox>
        <FieldBox
          label="الإحداثيات (تقريبي)"
          span={2}
          href={mapUrl ?? undefined}
        >
          {mapUrl && !property.locationMapUrl.trim()
            ? "عرض على الخريطة"
            : undefined}
        </FieldBox>
      </FieldsGrid>

      <SectionDivider />
      <SectionHeader>البيانات المساحية</SectionHeader>
      <FieldsGrid>
        <FieldBox label="التصنيف" value={property.classification} />
        <FieldBox label="النوع / الاستخدام" value={property.propertyType} />
        <FieldBox
          label="المساحة الإجمالية"
          value={property.area.trim() ? `${property.area.trim()} م²` : ""}
        />
        <FieldBox
          label="الأطوال والأبعاد"
          value={boundaryDimensions}
          emptyLabel={dimensionsEmpty}
        />
        <FieldBox
          label="واجهات الأرض"
          value={landFrontages}
          emptyLabel={frontagesEmpty}
        />
      </FieldsGrid>

      <SectionDivider />
      <SectionHeader>بيانات الاتصال</SectionHeader>
      {validContacts.length === 0 ? (
        <InfoBox icon="ℹ">لا يوجد ضابط اتصال مسجّل.</InfoBox>
      ) : (
        <FieldsGrid cols={2}>
          <FieldBox
            label="جهة الاتصال"
            value={primaryContact.role.trim() || "المالك"}
          />
          <FieldBox label="رقم الجوال" value={primaryContact.phone} ltr />
        </FieldsGrid>
      )}

      {showBourseSection ? (
        <>
          <SectionDivider />
          <SectionHeader>بيانات الاستعلام — البورصة العقارية</SectionHeader>
          {boursePending && !hasBourseDetailFields(property) ? (
            <InfoBox variant="amber" icon="ℹ">
              لم تُسجَّل بعد بيانات استعلام البورصة — أكملها من «استعلام
              البورصة» في الشريط العلوي.
            </InfoBox>
          ) : (
            <>
              {property.bourseDataCompleted ? (
                <InfoBox variant="teal" icon="✓">
                  اكتمل استعلام البورصة العقارية بنجاح
                  {record.receivedFromEnfathAt ? (
                    <>
                      {" بتاريخ "}
                      <bdi dir="ltr" className={ltrValueClass}>
                        {formatDateAr(record.receivedFromEnfathAt)}
                      </bdi>
                    </>
                  ) : null}
                  .
                </InfoBox>
              ) : null}
              <FieldsGrid>
                <FieldBox
                  label="حالة الصك في البورصة"
                  value={property.deedStatus}
                />
                <FieldBox
                  label="الأطوال والأبعاد"
                  value={boundaryDimensions}
                  emptyLabel={dimensionsEmpty}
                />
                <FieldBox
                  label="واجهات الأرض"
                  value={landFrontages}
                  emptyLabel={frontagesEmpty}
                />
                <FieldBox
                  label="الفروق / الملاحظات"
                  emptyLabel="لا توجد فروق"
                />
                <FieldBox
                  label="تاريخ آخر تحديث"
                  ltr
                  value={
                    record.receivedFromEnfathAt
                      ? formatDateAr(record.receivedFromEnfathAt)
                      : ""
                  }
                />
              </FieldsGrid>
            </>
          )}
        </>
      ) : null}
    </>
  );
}

export function PoPropertyDetailTabs({
  record,
  property,
  showDecree,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  showDecree: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<TabId>(() =>
    TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : "basic",
  );
  const [selectedPartyRole, setSelectedPartyRole] =
    useState<PropertyDetailPartyRoleKey | null>(null);
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const poNumber = record.poNumber.trim();

  const task = useMemo(
    () => caseStudyTaskForProperty(poNumber, property.id, tasks),
    [poNumber, property.id, tasks],
  );

  const { data: failures = [] } = useFailuresQuery();
  const propertyFailures = useMemo(
    () =>
      failuresForProperty(failures, {
        poNumber,
        propertyId: property.id,
        deedNumber: property.deedNumber,
      }),
    [failures, poNumber, property.id, property.deedNumber],
  );

  const samePoLinkedCount = useMemo(
    () => record.properties.filter((p) => p.id !== property.id).length,
    [record.properties, property.id],
  );

  const surveyTask = useMemo(
    () =>
      task
        ? findSurveyChildForParent(task.id, property.id, tasks)
        : null,
    [task, property.id, tasks],
  );

  const appraisalTask = useMemo(() => {
    if (!task) return null;
    return (
      childTasksForCaseStudyParent(task.id, tasks).find(
        (t) => t.kind === "property-appraisal",
      ) ?? null
    );
  }, [task, tasks]);

  const inspectionTask = useMemo(() => {
    const fromParent = task
      ? childTasksForCaseStudyParent(task.id, tasks).find(
          (t) => t.kind === "field-inspection",
        )
      : null;
    if (fromParent) return fromParent;
    return (
      tasks.find(
        (t) =>
          t.kind === "field-inspection" &&
          t.poNumber.trim() === poNumber &&
          t.propertyId === property.id,
      ) ?? null
    );
  }, [task, tasks, poNumber, property.id]);

  const propertyDocumentSections = usePropertyDetailDocuments({
    property,
    showDecree,
    poNumber,
    surveyTaskId: surveyTask?.id ?? null,
    appraisalTaskId: appraisalTask?.id ?? null,
    inspectionTaskId: inspectionTask?.id ?? null,
  });

  const docCount = countPropertyDetailDocuments(propertyDocumentSections);
  const photoCount = countPropertyDetailPhotos(propertyDocumentSections);
  const propertyPhotos = useMemo(
    () => listPropertyDetailPhotos(propertyDocumentSections),
    [propertyDocumentSections],
  );
  const partyCards = buildPropertyDetailPartyCards({
    task: task ?? null,
    allTasks: tasks,
    staffUsers,
  });
  const appraisalCard = partyCards.find((c) => c.roleKey === "appraisal") ?? null;
  const selectedPartyCard =
    partyCards.find((card) => card.roleKey === selectedPartyRole) ?? null;
  const coordinatorCard = partyCards.find((c) => c.roleKey === "coordinator");
  const coordinatorName =
    coordinatorCard && !coordinatorCard.unassigned ? coordinatorCard.name : "";

  const governmentCard =
    partyCards.find((c) => c.roleKey === "government") ?? null;

  const partySubmissionsQuery = usePropertyDetailPartySubmissionsQuery({
    parentTask: task ?? null,
    allTasks: tasks,
    coordinatorName,
    enabled:
      tab === "parties" ||
      tab === "keys" ||
      tab === "enfath-upload" ||
      tab === "appraisal" ||
      tab === "finance" ||
      tab === "survey-notes" ||
      Boolean(surveyTask),
  });

  const engineeringPartyNotes = partySubmissionsQuery.data?.survey?.remarks ?? [];

  const logEventsQuery = usePropertyTimelineQuery(poNumber, property.id);
  const fallbackLogEvents = useMemo(
    () =>
      [...buildPropertyDetailTimeline({ record, property, tasks })].reverse(),
    [record, property, tasks, propertyFailures],
  );
  const logEvents =
    logEventsQuery.data && logEventsQuery.data.length > 0
      ? [...logEventsQuery.data].reverse()
      : fallbackLogEvents;

  const propertyFeeTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.poNumber.trim() === poNumber &&
          t.propertyId === property.id &&
          (t.kind === "field-inspection" || t.kind === "engineering-survey"),
      ),
    [tasks, poNumber, property.id],
  );

  const propertyFeeTaskIds = useMemo(
    () => new Set(propertyFeeTasks.map((t) => t.id)),
    [propertyFeeTasks],
  );

  const { data: propertyFeesSummary } = useInspectorFeesQuery(
    { submittedOnly: false },
    { enabled: propertyFeeTaskIds.size > 0 },
  );

  const propertyFeeRows = useMemo(
    () =>
      (propertyFeesSummary?.rows ?? []).filter((row) =>
        propertyFeeTaskIds.has(row.workflowTaskId),
      ),
    [propertyFeesSummary?.rows, propertyFeeTaskIds],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TabBar
        className="sticky top-0 z-10 bg-surface max-lg:border-b max-lg:border-border/60"
        aria-label="أقسام تفاصيل العقار"
      >
        {TABS.map((t) => {
          let count: number | null = null;
          let countTone: "teal" | "red" | "gray" = "gray";
          if (t.id === "documents" && docCount > 0) {
            count = docCount;
            countTone = "teal";
          }
          if (t.id === "linked" && samePoLinkedCount > 0) {
            count = samePoLinkedCount;
            countTone = "teal";
          }
          if (t.id === "failures" && propertyFailures.length > 0) {
            count = propertyFailures.length;
            countTone = "red";
          }
          if (t.id === "photos" && photoCount > 0) {
            count = photoCount;
            countTone = "teal";
          }
          if (t.id === "finance" && propertyFeeRows.length > 0) {
            const pending = propertyFeeRows.filter(
              (r) =>
                r.billingStatus === "draft" ||
                r.billingStatus === "returned" ||
                r.billingStatus === "inquiry",
            ).length;
            count = pending > 0 ? pending : propertyFeeRows.length;
            countTone = pending > 0 ? "gray" : "teal";
          }
          if (t.id === "keys") {
            const govSubmission = partySubmissionsQuery.data?.government;
            if (govSubmission?.hasData) {
              const keysField = govSubmission.fields.find(
                (f: { label: string; value: string }) => f.label === "حالة المفاتيح",
              );
              if (keysField?.value?.includes("استلام")) {
                count = 1;
                countTone = "teal";
              } else if (keysField?.value) {
                count = 1;
                countTone = "gray";
              }
            }
          }

          return (
            <Tab
              key={t.id}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {count !== null ? (
                <TabCount tone={countTone}>{count}</TabCount>
              ) : null}
            </Tab>
          );
        })}
      </TabBar>

      <div className="flex min-h-0 flex-1 flex-col items-stretch overflow-hidden lg:flex-row">
        <TabPanel className="order-1 min-h-0">
          {tab === "basic" ? (
            <BasicTab record={record} property={property} />
          ) : null}

          {tab === "documents" ? (
            <DocumentsTab sections={propertyDocumentSections} />
          ) : null}

          {tab === "linked" ? (
            <PropertyDetailLinkedTab
              record={record}
              property={property}
              caseStudyTask={task ?? null}
            />
          ) : null}

          {tab === "failures" ? (
            propertyFailures.length > 0 ? (
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
                    <div className="flex shrink-0 items-center gap-1.5">
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
                <p className="mt-3">
                  <Button
                    type="button"
                    size="sm"
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
                <p className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      router.push(poPropertyFailurePath(poNumber, property.id))
                    }
                  >
                    تسجيل تعذّر جديد
                  </Button>
                </p>
              </>
            )
          ) : null}

          {tab === "parties" ? (
            <>
              <SectionHeader>الأطراف المعيّنة</SectionHeader>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {partyCards.map((card) => {
                  const selected = selectedPartyRole === card.roleKey;
                  const submittedAt =
                    partySubmissionsQuery.data?.[card.roleKey]?.submittedAtUtc?.trim() ||
                    null;
                  return (
                    <button
                      key={card.roleKey}
                      type="button"
                      className={cn(
                        "w-full rounded-[var(--radius-DEFAULT)] border border-transparent bg-surface-2 px-3.5 py-3 text-start font-[inherit] text-inherit transition-colors hover:border-border",
                        "cursor-pointer",
                        selected && "border-success bg-success-bg",
                      )}
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedPartyRole((prev) =>
                          prev === card.roleKey ? null : card.roleKey,
                        )
                      }
                    >
                      <div className="mb-1 text-[11px] text-text-3">
                        {card.role}
                      </div>
                      <div
                        className={cn(
                          "mb-1.5 text-[13px] font-medium text-text",
                          card.unassigned && "font-normal text-text-3",
                        )}
                      >
                        {card.name}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            partyDotClass(partyCardDotClass(card)),
                          )}
                        />
                        <span className="text-[11px] text-text-2">
                          {partyCardStatusLabel(card)}
                        </span>
                      </div>
                      {submittedAt ? (
                        <div
                          className={cn(
                            "mt-1.5 text-[10px] text-text-3",
                            ltrValueClass,
                          )}
                        >
                          {formatTimelineDate(submittedAt)}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {selectedPartyCard ? (
                <PartyRoleDetailPanel
                  card={selectedPartyCard}
                  submission={
                    partySubmissionsQuery.data?.[selectedPartyCard.roleKey] ??
                    null
                  }
                  loading={
                    partySubmissionsQuery.isLoading ||
                    partySubmissionsQuery.isFetching
                  }
                />
              ) : null}
            </>
          ) : null}

          {tab === "report" ? (
            <>
              <SectionHeader>نموذج دراسة الحالة</SectionHeader>
              <PropertyDetailCaseStudyReport
                record={record}
                property={property}
                task={task ?? null}
              />
            </>
          ) : null}

          {tab === "appraisal" ? (
            <PropertyDetailAppraisalTab
              submission={partySubmissionsQuery.data?.appraisal ?? null}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
              appraisalTaskId={appraisalTask?.id ?? null}
              appraiserName={
                appraisalCard && !appraisalCard.unassigned
                  ? appraisalCard.name
                  : ""
              }
            />
          ) : null}

          {tab === "photos" ? (
            <PropertyDetailPhotosTab photos={propertyPhotos} />
          ) : null}

          {tab === "log" ? (
            logEvents.length === 0 ? (
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
                          logIconClass(event.tone),
                        )}
                        aria-hidden
                      >
                        {logIconGlyph(event.tone)}
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
            )
          ) : null}

          {tab === "keys" ? (
            <PropertyDetailPropertyKeys
              property={property}
              governmentCard={governmentCard}
              submission={partySubmissionsQuery.data?.government ?? null}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
            />
          ) : null}

          {tab === "enfath-upload" ? (
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
          ) : null}

          {tab === "finance" ? (
            <PropertyDetailFinanceTab
              poNumber={poNumber}
              property={property}
              tasks={tasks}
            />
          ) : null}

          {tab === "survey-notes" ? (
            <PropertyDetailSurveyNotesTab
              remarks={engineeringPartyNotes}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
            />
          ) : null}
        </TabPanel>

        <div className="order-2 flex h-full min-h-0 min-w-0 shrink-0 max-lg:hidden">
          <PropertyTransactionTimeline record={record} property={property} />
        </div>
      </div>
    </div>
  );
}
