"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  findSurveyChildForParent,
} from "@engineering-office/mfe";
import { useMemo, useState, useEffect } from "react";
import {
  failuresForProperty,
  useFailuresQuery,
} from "@failures/mfe";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import type { FailureRecord } from "@failures/mfe";
import { Button, cn, Tab, TabBar, TabCount, TabPanel } from "@platform/design-system";
import {
  DetailBadge,
  EmptyState,
  FieldBox,
  FieldsGrid,
  InfoBox,
  ltrValueClass,
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
import { PropertyDetailMobileGlance } from "./PropertyDetailMobileGlance";
import { PropertyDetailMediaGlance } from "./PropertyDetailMediaGlance";
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
  partyCardStatusLabel,
  type PropertyDetailPartyCard,
} from "../../lib/prototype/property-detail-parties";
import type { PropertyDetailPartySubmission } from "../../lib/prototype/property-detail-party-submissions";
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
import {
  activeSurveyWorkspacePath,
  operationsTasksPath,
  propertyAppraisalWorkspacePath,
  propertyInspectionWorkspacePath,
} from "../../lib/my-task-routes";
import {
  loadSeenPropertyTabs,
  markPropertyTabSeen,
  propertyTabHasNewDot,
} from "../../lib/prototype/property-detail-local-ui";

const TABS = [
  { id: "basic", label: "البيانات الأساسية" },
  { id: "documents", label: "مستندات العقار" },
  { id: "linked", label: "العقارات المرتبطة" },
  { id: "survey", label: "التقرير المساحي" },
  { id: "inspection", label: "معاينة العقار" },
  { id: "photos", label: "صور العقار" },
  { id: "government", label: "المراجعات الحكومية" },
  { id: "appraisal", label: "تقييم العقار" },
  { id: "keys", label: "مفاتيح العقار" },
  { id: "report", label: "دراسة العقار" },
  { id: "failures", label: "التعذرات" },
  { id: "enfath-upload", label: "الرفع على انفاذ" },
  { id: "finance", label: "المالية" },
  { id: "log", label: "السجل والتدقيق" },
  { id: "survey-notes", label: "ملاحظات" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PartyWorkTab({
  card,
  submission,
  loading,
  description,
  actionHref,
  actionLabel,
}: {
  card: PropertyDetailPartyCard | null;
  submission: PropertyDetailPartySubmission | null;
  loading: boolean;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  if (!card) {
    return (
      <EmptyState
        title="لم يُعيَّن طرف لهذا الدور"
        sub="سيظهر هنا الطرف وبيانات عمله بعد التعيين."
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
        <div>
          <div className="text-[13px] font-bold text-heading">{card.role}</div>
          <div className={cn("mt-0.5 text-[11px]", card.unassigned ? "text-text-3" : "text-text-2")}>
            {card.name}
          </div>
        </div>
        <DetailBadge tone={card.unassigned ? "gray" : card.state === "done" ? "teal" : "amber"}>
          {partyCardStatusLabel(card)}
        </DetailBadge>
      </div>
      <div className="rounded-xl border border-dashed border-border-md bg-surface px-5 py-4 text-center text-[12px] leading-relaxed text-text-3">
        {description}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg bg-ink px-[18px] py-2 text-[12.5px] font-bold text-white no-underline shadow-[0_6px_16px_-8px_rgba(18,40,76,0.6)] hover:bg-[#22406e] max-lg:min-h-11 max-lg:w-full"
        >
          {actionLabel}
        </Link>
      ) : null}
      <PartyRoleDetailPanel card={card} submission={submission} loading={loading} />
    </>
  );
}

function docExtLabel(doc: PropertyDetailDocumentEntry): string {
  if (doc.kind === "pdf") return "PDF";
  if (doc.kind === "image") return "IMG";
  const parts = doc.fileName.trim().split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1]!.toUpperCase() : "DOC";
  return ext.slice(0, 4) || "DOC";
}

function DocumentRow({ doc }: { doc: PropertyDetailDocumentEntry }) {
  const canDownload = Boolean(
    doc.dataUrl || doc.attachmentId || doc.engineeringTaskId,
  );
  const pending = !canDownload;
  const ext = docExtLabel(doc);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2.5 rounded border border-border bg-surface-2 px-3 py-2.5",
        pending && "opacity-70",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-border text-[9px] font-extrabold",
            pending
              ? "bg-surface text-text-3"
              : "bg-[color-mix(in_srgb,#a4906f_14%,transparent)] text-[#8c7857]",
          )}
          aria-hidden
        >
          {ext}
        </span>
        <span className="inline-flex min-w-0 flex-col gap-px">
          <span className="truncate text-[12.5px] font-semibold text-text">
            {doc.name}
          </span>
          <span className="truncate text-[10.5px] text-text-3">
            {doc.source}
            {!pending ? (
              <>
                {" · "}
                <bdi dir="ltr" className={ltrValueClass}>
                  {doc.fileName}
                </bdi>
              </>
            ) : null}
          </span>
        </span>
      </div>
      {pending ? (
        <span className="shrink-0 text-[11px] font-bold text-text-3">
          لم يُرفع بعد
        </span>
      ) : (
        <button
          type="button"
          className="shrink-0 rounded-md border border-border-md bg-surface px-3 py-1 text-[11px] font-bold text-text-2 max-lg:min-h-11"
          onClick={() => downloadPropertyDetailDocument(doc)}
        >
          تنزيل
        </button>
      )}
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
        <section key={section.id} className="mb-3.5">
          <div className="mb-[7px] flex items-center gap-2">
            <span className="text-xs font-bold text-heading">{section.title}</span>
            <span className="text-[10.5px] text-text-3">
              {section.documents.length} مستند
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          {section.documents.length === 0 ? (
            <InfoBox icon="ℹ">لا توجد مستندات في هذا القسم بعد.</InfoBox>
          ) : (
            <div className="grid gap-2">
              {section.documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </section>
      ))}
      <p className="m-0 text-[11.5px] text-text-3">
        تُرفع المستندات من كل طرف تحت قسمه — التقرير المساحي من المكتب الهندسي
        عند إصداره، وتقرير المعاينة عند اكتمالها.
      </p>
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
  primaryPhoto,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  primaryPhoto?: PropertyDetailDocumentEntry | null;
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
      <PropertyDetailMediaGlance
        property={property}
        primaryPhoto={primaryPhoto}
      />

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
          <SectionHeader>بيانات الاستعلام — البورصة العقارية</SectionHeader>
          {boursePending && !hasBourseDetailFields(property) ? (
            <InfoBox variant="amber" icon="ℹ">
              لم تُسجَّل بعد بيانات استعلام البورصة — أكملها من «استعلام
              البورصة» في شريط الإجراءات.
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
  const [seenTabs, setSeenTabs] = useState<Set<string>>(() => new Set());
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const poNumber = record.poNumber.trim();

  useEffect(() => {
    setSeenTabs(loadSeenPropertyTabs(property.id));
  }, [property.id]);

  useEffect(() => {
    markPropertyTabSeen(property.id, tab);
    setSeenTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [property.id, tab]);

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

  const governmentTask = useMemo(
    () =>
      task
        ? childTasksForCaseStudyParent(task.id, tasks).find(
            (t) => t.kind === "government-review",
          ) ?? null
        : null,
    [task, tasks],
  );

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
  const primaryPhoto = useMemo(() => {
    const preferred = propertyPhotos.find((p) =>
      /رئيس|main|primary/i.test(`${p.name} ${p.fileName}`),
    );
    return (
      preferred ??
      propertyPhotos.find((p) => Boolean(p.dataUrl)) ??
      propertyPhotos[0] ??
      null
    );
  }, [propertyPhotos]);
  const partyCards = buildPropertyDetailPartyCards({
    task: task ?? null,
    allTasks: tasks,
    staffUsers,
  });
  const appraisalCard = partyCards.find((c) => c.roleKey === "appraisal") ?? null;
  const inspectionCard =
    partyCards.find((c) => c.roleKey === "inspection") ?? null;
  const surveyCard = partyCards.find((c) => c.roleKey === "survey") ?? null;
  const coordinatorCard = partyCards.find((c) => c.roleKey === "coordinator");
  const coordinatorName =
    coordinatorCard && !coordinatorCard.unassigned ? coordinatorCard.name : "";

  const governmentCard =
    partyCards.find((c) => c.roleKey === "government") ?? null;

  const partySubmissionsQuery = usePropertyDetailPartySubmissionsQuery({
    parentTask: task ?? null,
    allTasks: tasks,
    coordinatorName,
    enabled: true,
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

  const govSubmission = partySubmissionsQuery.data?.government ?? null;
  const keysStatusField = govSubmission?.fields.find(
    (f: { label: string; value: string }) => f.label === "حالة المفاتيح",
  );
  const keysStatus = keysStatusField?.value?.trim() ?? "";
  const keysHasData = Boolean(
    keysStatus ||
      govSubmission?.remarks.some((r) => r.label === "المفاتيح / موقع الحفظ"),
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PropertyDetailMobileGlance
        poNumber={poNumber}
        property={property}
        keysStatus={keysStatus}
        keysHasData={keysHasData}
        feeRows={propertyFeeRows}
        failureCount={propertyFailures.length}
        onOpenTab={(next) => setTab(next)}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
          <TabBar
            className="z-10 mx-0 gap-0.5 overflow-x-auto border-b border-border bg-transparent px-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:h-0"
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
                    r.billingStatus === "inquiry" ||
                    r.billingStatus === "sup-review" ||
                    r.billingStatus === "office-review",
                ).length;
                count = pending > 0 ? pending : propertyFeeRows.length;
                countTone = pending > 0 ? "gray" : "teal";
              }
              if (t.id === "keys") {
                if (keysHasData) {
                  count = 1;
                  countTone = keysStatus.includes("استلام") ? "teal" : "gray";
                }
              }

              const active = tab === t.id;
              const hasNew = propertyTabHasNewDot(property.id, t.id, seenTabs);
              return (
                <Tab
                  key={t.id}
                  active={active}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative mb-0 border-b-0 px-2.5 py-[9px] text-[12.5px] font-normal",
                    "hover:bg-[color-mix(in_srgb,#102B4E_6%,transparent)] hover:text-heading",
                    active &&
                      "!border-b-0 !bg-ink !font-normal !text-white hover:!text-white",
                    hasNew &&
                      "after:absolute after:top-1.5 after:end-[3px] after:h-[7px] after:w-[7px] after:rounded-full after:bg-[#c0392b] after:shadow-[0_0_0_2px_var(--surface,#fff)] after:content-['']",
                  )}
                >
                  {t.label}
                  {count !== null ? (
                    <TabCount
                      tone={countTone}
                      className={cn(active && "bg-white/15 text-white")}
                    >
                      {count}
                    </TabCount>
                  ) : null}
                </Tab>
              );
            })}
          </TabBar>

          <TabPanel className="min-h-0 overflow-visible bg-transparent px-5 py-5 sm:px-5">
          {tab === "basic" ? (
            <BasicTab
              record={record}
              property={property}
              primaryPhoto={primaryPhoto}
            />
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
            )
          ) : null}

          {tab === "survey" ? (
            <PartyWorkTab
              card={surveyCard}
              submission={partySubmissionsQuery.data?.survey ?? null}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
              description="الرفع المساحي ينفذه المكتب الهندسي — تأكيد حدود العقار وقد يتبعه تعديل التقييم."
              actionHref={
                surveyTask ? activeSurveyWorkspacePath(surveyTask.id) : undefined
              }
              actionLabel="رفع التقرير المساحي — مساحة عمل المكتب"
            />
          ) : null}

          {tab === "inspection" ? (
            <PartyWorkTab
              card={inspectionCard}
              submission={partySubmissionsQuery.data?.inspection ?? null}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
              description="المعاينة الميدانية شرط بدء التقييم — صور مختومة وتقرير ميداني."
              actionHref={
                inspectionTask
                  ? propertyInspectionWorkspacePath(inspectionTask.id)
                  : undefined
              }
              actionLabel="معاينة العقار — مساحة عمل المعاين"
            />
          ) : null}

          {tab === "government" ? (
            <PartyWorkTab
              card={governmentCard}
              submission={partySubmissionsQuery.data?.government ?? null}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
              description="المراجعات الحكومية والبيانات والمستندات والمواعيد الخاصة بالمراجع تظهر هنا."
              actionHref={
                governmentTask ? operationsTasksPath() : undefined
              }
              actionLabel="فتح مساحة عمل المراجعة الحكومية"
            />
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
              workspaceHref={
                appraisalTask
                  ? propertyAppraisalWorkspacePath(appraisalTask.id)
                  : undefined
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
              poNumber={poNumber}
              propertyId={property.id}
            />
          ) : null}
          </TabPanel>
        </div>

        <div className="sticky top-0 max-lg:hidden">
          <PropertyTransactionTimeline record={record} property={property} />
        </div>
      </div>
    </div>
  );
}
