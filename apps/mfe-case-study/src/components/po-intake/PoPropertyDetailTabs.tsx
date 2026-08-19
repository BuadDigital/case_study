"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { findSurveyChildForParent } from "@engineering-office/mfe";
import { useMemo, useState, useEffect } from "react";
import { failuresForProperty, useFailuresQuery } from "@failures/mfe";
import { failureStatusLabel } from "@failures/mfe/lib/failures-labels";
import type { FailureRecord } from "@failures/mfe";
import { Button, cn, Tab, TabBar, TabPanel } from "@platform/ui-kit";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { canViewPropertyTimelineRail } from "../../lib/prototype/po-roles";
import { DetailBadge, EmptyState, FieldBox, FieldsGrid, InfoBox, ltrValueClass, SectionHeader } from "./PropertyDetailFields";
import { PropertyDetailAppraisalTab } from "./PropertyDetailAppraisalTab";
import { PropertyDetailPhotosTab } from "./PropertyDetailPhotosTab";
import { PropertyDetailLinkedTab } from "./PropertyDetailLinkedTab";
import { PropertyDetailCaseStudyReport } from "./PropertyDetailCaseStudyReport";
import { PropertyDetailGovernmentReviewsTab } from "./PropertyDetailGovernmentReviewsTab";
import { PropertyDetailPropertyKeys } from "./PropertyDetailPropertyKeys";
import { PropertyDetailEnfathUpload } from "./PropertyDetailEnfathUpload";
import { PropertyDetailFinanceTab } from "./PropertyDetailFinanceTab";
import { PropertyDetailSurveyNotesTab, buildPartyRemarksSections } from "./PropertyDetailSurveyNotesTab";
import { PropertyTransactionTimeline } from "./PropertyTransactionTimeline";
import { PropertyDetailMobileGlance } from "./PropertyDetailMobileGlance";
import { PropertyDetailMediaGlance } from "./PropertyDetailMediaGlance";
import { PropertyDetailInspectionTab } from "./PropertyDetailInspectionTab";
import { PropertyDetailPartyPackageReview } from "./PropertyDetailPartyPackageReview";
import { boundariesAvailabilityLabel, boundariesMarkedUnavailable, formatDateAr, formatPropertyDeedDisplay,
  hasBourseDetailFields, 
  ownershipStatusLabel, 
  formatPropertyRestrictionsLine,
  showsCourtFields,
  skipsBourseForIdentifier,
  PROPERTY_BOUNDARY_ROWS,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import { isValidContactEntry } from "../../lib/domain/po-intake/property-validation";
import { PartyRoleDetailPanel } from "./PartyRoleDetailPanel";
import { buildPropertyDetailPartyCards, type PropertyDetailPartyCard } from "../../lib/prototype/property-detail-parties";
import { poPropertyFailurePath } from "../../lib/po-routes";
import { buildPropertyDetailTimeline, formatTimelineDate } from "../../lib/prototype/property-detail-timeline";
import { usePropertyTimelineQuery } from "../../query/use-property-timeline-query";
import { caseStudyTaskForProperty, type WorkflowTask } from "../../lib/prototype/tasks-storage";
import { childTasksForCaseStudyParent } from "../../lib/prototype/case-study-party-answers";
import { downloadPropertyDetailDocument, listPropertyDetailPhotos, type PropertyDetailDocumentEntry, type PropertyDetailDocumentSection } from "../../lib/prototype/property-detail-documents";
import { ReportAttachmentClassifyControls } from "./ReportAttachmentClassifyControls";
import { usePropertyDetailDocuments } from "../../query/property-detail-documents-query";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { usePropertyDetailPartySubmissionsQuery } from "../../query/property-detail-party-submissions-queries";
import { poPropertyPath } from "../../lib/po-routes";
import { usePropertyOperationsTasks } from "../../query/use-property-operations-tasks";
import { keysStatusLabelAr, usePropertyKeyGateQuery } from "../../query/use-property-key-gate-query";
import { loadSeenPropertyTabFingerprints, markPropertyTabSeen, propertyTabHasNewDot, type SeenPropertyTabMap} from "../../lib/prototype/property-detail-local-ui";
import { buildPropertyDetailTabActivity } from "../../lib/prototype/property-detail-tab-activity";

const TABS = [
  { id: "basic", label: "البيانات الأساسية" },
  { id: "documents", label: "مستندات العقار" },
  { id: "linked", label: "العقارات المرتبطة" },
  { id: "survey", label: "التقرير المساحي" },
  { id: "inspection", label: "معاينة العقار" },
  { id: "photos", label: "صور العقار" },
  { id: "government", label: "المراجعات الحكومية" },
  { id: "keys", label: "مفاتيح العقار" },
  { id: "appraisal", label: "تقييم العقار" },
  { id: "failures", label: "التعذرات" },
  { id: "report", label: "دراسة العقار" },
  { id: "enfath-upload", label: "الرفع على انفاذ" },
  { id: "finance", label: "المالية" },
  { id: "log", label: "السجل والتدقيق" },
  { id: "survey-notes", label: "ملاحظات" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** مراجعي حكومي: only the tabs they need for court-visit / keys work. */
const GOVERNMENT_REVIEWER_TAB_IDS: readonly TabId[] = [
  "basic",
  "government",
  "keys",
  "survey-notes",
];

/**
 * Real-estate appraiser: study + valuation workspace only
 * (no survey package, court/keys, enfaz upload, finance, or audit log).
 */
const REAL_ESTATE_APPRAISER_TAB_IDS: readonly TabId[] = [
  "basic",
  "documents",
  "linked",
  "inspection",
  "photos",
  "appraisal",
  "failures",
  "report",
  "survey-notes",
];

/** مكتب هندسي: survey package + dues/notes. */
const ENGINEERING_OFFICE_TAB_IDS: readonly TabId[] = [
  "basic",
  "survey",
  "failures",
  "finance",
  "survey-notes",
];

/** معاين ميداني: inspection media + dues/notes. */
const FIELD_INSPECTOR_TAB_IDS: readonly TabId[] = [
  "basic",
  "documents",
  "linked",
  "inspection",
  "photos",
  "failures",
  "finance",
  "survey-notes",
];

const ROLE_PROPERTY_DETAIL_TABS: Readonly< Partial<Record<string, readonly TabId[]>>> = {
  "government-reviewer": GOVERNMENT_REVIEWER_TAB_IDS,
  "real-estate-appraiser": REAL_ESTATE_APPRAISER_TAB_IDS,
  "engineering-office": ENGINEERING_OFFICE_TAB_IDS,
  "field-inspector": FIELD_INSPECTOR_TAB_IDS,
};

function propertyDetailTabsForRole(
  role: string,
): readonly (typeof TABS)[number][] {
  const allowed = ROLE_PROPERTY_DETAIL_TABS[role];
  if (!allowed) return TABS;
  return TABS.filter((t) => (allowed as readonly string[]).includes(t.id));
}

function isAllowedPropertyTab(
  role: string,
  tabId: string | null | undefined,
): tabId is TabId {
  if (!tabId) return false;
  return propertyDetailTabsForRole(role).some((t) => t.id === tabId);
}

function docExtLabel(doc: PropertyDetailDocumentEntry): string {
  if (doc.kind === "pdf") return "PDF";
  if (doc.kind === "image") return "IMG";
  const parts = doc.fileName.trim().split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1]!.toUpperCase() : "DOC";
  return ext.slice(0, 4) || "DOC";
}

function suggestDocKindForClassify(doc: PropertyDetailDocumentEntry): string {
  const id = doc.id.toLowerCase();
  if (id.includes("reg")) return "registry";
  if (id.includes("assignment") || id.includes("decree")) return "decree";
  if (id.includes("bourse")) return "bourse-deed";
  if (id.includes("deed")) return "deed";
  if (id.includes("delegation")) return "delegation";
  if (id.includes("boundar") || id.includes("survey")) return "boundaries";
  if (id.includes("map") || id.includes("site")) return "site-map";
  if (id.includes("photo") || doc.kind === "image") return "photo";
  return "other";
}

function DocumentRow({
  doc,
  propertyTypeKey,
}: {
  doc: PropertyDetailDocumentEntry;
  propertyTypeKey?: string;
}) {
  const ext = docExtLabel(doc);
  const attachmentId = doc.attachmentId?.trim();

  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-[color-mix(in_srgb,#a4906f_14%,transparent)] text-[9px] font-extrabold text-[#8c7857]"
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
              {" · "}
              <bdi dir="ltr" className={ltrValueClass}>
                {doc.fileName}
              </bdi>
            </span>
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border-md bg-surface px-3 py-1 text-[11px] font-bold text-text-2 max-lg:min-h-11"
          onClick={() => downloadPropertyDetailDocument(doc)}
        >
          تنزيل
        </button>
      </div>
      {attachmentId ? (
        <ReportAttachmentClassifyControls
          attachmentId={attachmentId}
          docKind={suggestDocKindForClassify(doc)}
          propertyTypeKey={propertyTypeKey}
        />
      ) : null}
    </div>
  );
}

function DocumentsTab({
  sections,
  propertyTypeKey,
}: {
  sections: PropertyDetailDocumentSection[];
  propertyTypeKey?: string;
}) {
  if (sections.length === 0) {
    return (
      <InfoBox icon="ℹ">لا توجد مستندات مرفوعة لهذا العقار بعد.</InfoBox>
    );
  }

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
          <div className="grid gap-2">
            {section.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} propertyTypeKey={propertyTypeKey} />
            ))}
          </div>
        </section>
      ))}
      <p className="m-0 text-[11.5px] text-text-3">
        تُرفع المستندات من كل طرف تحت قسمه — التقرير المساحي من المكتب الهندسي
        عند إصداره، وتقرير المعاينة عند اكتمالها.
      </p>
    </>
  );
}

/** Case Study.html logPanel — always green ✓ circle. */
function logIconGlyph(): string {
  return "✓";
}

function logIconClass(): string {
  return "bg-[color-mix(in_srgb,#3f8f5f_10%,transparent)] text-[#2f7a4d]";
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
  const ownershipStatus = ownershipStatusLabel(property);
  const boundaryRows = PROPERTY_BOUNDARY_ROWS.map((row) => ({
    label: row.label,
    desc: property[row.descKey].trim(),
    len: property[row.lenKey].trim(),
  }));
  const hasBoundaryRows = boundaryRows.some((r) => r.desc || r.len);
  const boundariesUnavailable = boundariesMarkedUnavailable( property.boundariesAvailability );
  const boundariesAwaiting = !boundariesUnavailable && !hasBoundaryRows && !property.bourseDataCompleted;

  return (
    <>
      <PropertyDetailMediaGlance
        property={property}
        primaryPhoto={primaryPhoto}
      />

      <SectionHeader>بيانات الصك</SectionHeader>
      <FieldsGrid>
        <FieldBox label="رقم أمر العمل" value={record.poNumber} ltr />
        <FieldBox label="رقم الصك" value={property.deedNumber} ltr />
        <FieldBox label="تاريخ الصك" value={property.deedDate} ltr />
        <FieldBox
          label="تسجيل عيني"
          value={property.realEstateRegNumber}
          ltr
        />
        <FieldBox
          label="تاريخ التسجيل العيني"
          value={property.realEstateRegDate}
          ltr
        />
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
      </FieldsGrid>

      <SectionHeader>البيانات المساحية</SectionHeader>
      <FieldsGrid>
        <FieldBox label="التصنيف" value={property.classification} />
        <FieldBox label="النوع / الاستخدام" value={property.propertyType} />
        <FieldBox
          label="المساحة الإجمالية"
          value={property.area.trim() ? `${property.area.trim()} م²` : ""}
        />
      </FieldsGrid>

      <div className="mb-2 mt-3.5 text-[11.5px] font-bold text-heading">
        حدود العقار وأطواله
      </div>
      {boundariesUnavailable ? (
        <InfoBox icon="ℹ">الحدود غير متوفرة لهذا العقار.</InfoBox>
      ) : boundariesAwaiting ? (
        <div className="rounded border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-relaxed text-[#7a5b12]">
          بانتظار بيانات البورصة — تُعرض حدود العقار وأطوال أضلاعه بعد اكتمال
          الاستعلام.
        </div>
      ) : hasBoundaryRows ? (
        <>
          <div className="overflow-x-auto rounded border border-border">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-surface-2">
                  <th className="border-b border-border px-3 py-2 text-start text-[11px] font-bold text-text-2">
                    الحد
                  </th>
                  <th className="border-b border-border px-3 py-2 text-center text-[11px] font-bold text-text-2">
                    وصف الحد
                  </th>
                  <th className="border-b border-border px-3 py-2 text-center text-[11px] font-bold text-text-2">
                    طول الضلع
                  </th>
                </tr>
              </thead>
              <tbody>
                {boundaryRows.map((row, i) => (
                  <tr key={row.label}>
                    <td
                      className={cn(
                        "px-3 py-2 font-semibold text-heading",
                        i < boundaryRows.length - 1 && "border-b border-border",
                      )}
                    >
                      {row.label}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-center text-text",
                        i < boundaryRows.length - 1 && "border-b border-border",
                      )}
                    >
                      {row.desc || "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-center text-text [direction:ltr]",
                        i < boundaryRows.length - 1 && "border-b border-border",
                      )}
                    >
                      {row.len ? `${row.len} م` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 mb-0 text-[10.5px] text-text-3">
            «بطول» = طول ضلع العقار على ذلك الحد. المصدر: البورصة العقارية /
            الصك.
          </p>
        </>
      ) : (
        <InfoBox icon="ℹ">لم تُسجَّل حدود وأطوال بعد.</InfoBox>
      )}

      <SectionHeader>بيانات الاتصال</SectionHeader>
      <p className="-mt-1 mb-2 text-[10.5px] text-text-3">
        المصدر: البيانات الأولية للمعاملة
      </p>
      {validContacts.length === 0 ? (
        <InfoBox icon="ℹ">لا يوجد ضابط اتصال مسجّل.</InfoBox>
      ) : (
        <FieldsGrid cols={3}>
          <FieldBox label="الاسم" value={primaryContact.name.trim() || "—"} />
          <FieldBox label="رقم الجوال" value={primaryContact.phone} ltr />
          <FieldBox
            label="الصلة"
            value={primaryContact.role.trim() || "المالك"}
          />
        </FieldsGrid>
      )}

      {showBourseSection ? (
        <>
          <SectionHeader>بيانات الاستعلام — البورصة العقارية</SectionHeader>
          {boursePending && !hasBourseDetailFields(property) ? (
            <InfoBox variant="amber" icon="ℹ">
              لم تُسجَّل بعد بيانات استعلام البورصة — أكملها من «استعلام
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
                  label="توفر الحدود"
                  value={boundariesAvailabilityLabel(
                    property.boundariesAvailability,
                  )}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role } = usePrototype();
  const visibleTabs = useMemo(() => propertyDetailTabsForRole(role), [role]);
  const showCaseStudySideRail = canViewPropertyTimelineRail(role);
  const initialTab = searchParams.get("tab");
  const inspectParam = searchParams.get("inspect");
  const workspaceForced = Boolean(inspectorWorkspace);
  const [tab, setTab] = useState<TabId>(() => {
    if (workspaceForced) return "inspection";
    if (isAllowedPropertyTab(role, initialTab)) return initialTab;
    return visibleTabs[0]?.id ?? "basic";
  });
  const [inspectEdit, setInspectEdit] = useState(() => {
    if (workspaceForced) return inspectorWorkspace?.forceEdit !== false;
    return inspectParam === "edit";
  });
  const [seenTabs, setSeenTabs] = useState<SeenPropertyTabMap>(() => ({}));
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const poNumber = record.poNumber.trim();

  const replaceInspectQuery = (inspect: "edit" | null) => {
    /* Inspector workspace stays on /active-inspection — do not jump to PO property URL. */
    if (workspaceForced) return;
    const base = poPropertyPath(poNumber, property.id);
    if (inspect === "edit") {
      router.replace(`${base}?tab=inspection&inspect=edit`, { scroll: false });
      return;
    }
    router.replace(`${base}?tab=inspection`, { scroll: false });
  };

  useEffect(() => {
    if (workspaceForced) {
      setTab("inspection");
      setInspectEdit(inspectorWorkspace?.forceEdit !== false);
      return;
    }
    const nextTab = searchParams.get("tab");
    if (isAllowedPropertyTab(role, nextTab)) {
      setTab(nextTab);
    }
    const nextInspect = searchParams.get("inspect");
    /* Input mode only when ?inspect=edit (from the button) — not merely opening the tab. */
    setInspectEdit(nextInspect === "edit");
  }, [searchParams, workspaceForced, inspectorWorkspace?.forceEdit, role]);

  useEffect(() => {
    if (workspaceForced) return;
    if (!visibleTabs.some((t) => t.id === tab)) {
      setTab(visibleTabs[0]?.id ?? "basic");
    }
  }, [visibleTabs, tab, workspaceForced]);

  useEffect(() => {
    setSeenTabs(loadSeenPropertyTabFingerprints(property.id));
  }, [property.id]);

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
    if (inspectorWorkspace?.task) return inspectorWorkspace.task;
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
  }, [inspectorWorkspace?.task, task, tasks, poNumber, property.id]);

  const propertyDocumentSections = usePropertyDetailDocuments({
    property,
    showDecree,
    poNumber,
    surveyTaskId: surveyTask?.id ?? null,
    appraisalTaskId: appraisalTask?.id ?? null,
    inspectionTaskId: inspectionTask?.id ?? null,
  });

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
  const inspectionCardFromParties =
    partyCards.find((c) => c.roleKey === "inspection") ?? null;
  const inspectionCard: PropertyDetailPartyCard | null =
    inspectionCardFromParties ??
    (inspectionTask
      ? {
          roleKey: "inspection",
          role: "المعاين",
          name:
            resolveAssigneeDisplayName({
              assigneeName: inspectionTask.assigneeName,
              assigneeId: inspectionTask.assigneeId,
              staffUsers,
              fallback: "المعاين",
            }) || "المعاين",
          unassigned: false,
          state: "progress",
          enabled: true,
        }
      : null);
  const surveyCard = partyCards.find((c) => c.roleKey === "survey") ?? null;

  const partySubmissionsQuery = usePropertyDetailPartySubmissionsQuery({
    parentTask: task ?? null,
    allTasks: tasks,
    enabled: true,
  });

  const partyRemarksSections = useMemo(
    () =>
      buildPartyRemarksSections({
        survey: partySubmissionsQuery.data?.survey ?? null,
        inspection: partySubmissionsQuery.data?.inspection ?? null,
        appraisal: partySubmissionsQuery.data?.appraisal ?? null,
      }),
    [partySubmissionsQuery.data],
  );

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

  const deedDisplay =
    formatPropertyDeedDisplay(property) || property.deedNumber.trim();
  const { primaryCourtVisit } = usePropertyOperationsTasks(
    {
      poNumber,
      deedNumber: property.deedNumber.trim(),
      deedDisplay,
    },
    { live: true },
  );
  const { data: keyGate } = usePropertyKeyGateQuery({
    propertyId: property.id,
    poNumber,
    deedNumber: property.deedNumber.trim(),
    requestNumber: property.requestNumber.trim() || undefined,
  });
  const keysStatus = keysStatusLabelAr(keyGate?.keysStatus ?? "");
  const keysHasData = Boolean(
    keyGate?.keysStatus ||
      keyGate?.envelopeId ||
      primaryCourtVisit?.linkedEnvelopeId ||
      primaryCourtVisit,
  );

  const governmentTask = useMemo(() => {
    if (!task) return null;
    return (
      childTasksForCaseStudyParent(task.id, tasks).find(
        (t) => t.kind === "government-review",
      ) ??
      tasks.find(
        (t) =>
          t.kind === "government-review" &&
          t.poNumber.trim() === poNumber &&
          t.propertyId === property.id,
      ) ??
      null
    );
  }, [task, tasks, poNumber, property.id]);

  const tabActivity = useMemo(
    () =>
      buildPropertyDetailTabActivity({
        parties: partySubmissionsQuery.data ?? null,
        failures: propertyFailures.map((f) => ({
          id: f.id,
          status: f.status,
          updatedAt: f.updatedAt,
        })),
        feeRows: propertyFeeRows.map((r) => ({
          workflowTaskId: r.workflowTaskId,
          billingStatus: r.billingStatus,
          updatedAtUtc: r.updatedAtUtc ?? null,
        })),
        logEvents: logEvents.map((e) => ({ id: e.id, at: e.at })),
        keysStatus: keyGate?.keysStatus ?? keysStatus,
        governmentReviewTaskStatus: governmentTask?.status ?? null,
        governmentReviewUpdatedAt: governmentTask?.updatedAt ?? null,
      }),
    [
      partySubmissionsQuery.data,
      propertyFailures,
      propertyFeeRows,
      logEvents,
      keyGate?.keysStatus,
      keysStatus,
      governmentTask,
    ],
  );

  useEffect(() => {
    const fingerprint = tabActivity[tab] ?? null;
    if (!fingerprint) return;
    markPropertyTabSeen(property.id, tab, fingerprint);
    setSeenTabs((prev) => {
      if (prev[tab] === fingerprint) return prev;
      return { ...prev, [tab]: fingerprint };
    });
  }, [property.id, tab, tabActivity]);

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
          setTab(next);
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
        <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface px-5 pb-5 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
          {/* Case Study.html `.tabs` inside card: margin 0 -20px, padding 0 14px, wrap, gap 2px */}
          <TabBar
            className="z-10 mx-[-20px] mb-0 flex flex-wrap gap-x-0.5 gap-y-0 overflow-visible whitespace-nowrap border-b border-border bg-transparent px-3.5 sm:px-3.5"
            aria-label="أقسام تفاصيل العقار"
          >
            {visibleTabs.map((t) => {
              const active = tab === t.id;
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
                    setTab(t.id);
                    if (workspaceForced) return;
                    /* Tab is view-only — input mode opens from the property-inspection button. */
                    if (t.id === "inspection" && inspectEdit) {
                      setInspectEdit(false);
                      replaceInspectQuery(null);
                    } else if (t.id !== "inspection" && inspectEdit) {
                      setInspectEdit(false);
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

          <TabPanel className="min-h-0 overflow-visible bg-transparent px-0 py-5 sm:px-0">
          {tab === "basic" ? (
            <BasicTab
              record={record}
              property={property}
              primaryPhoto={primaryPhoto}
            />
          ) : null}

          {tab === "documents" ? (
            <DocumentsTab sections={propertyDocumentSections} propertyTypeKey={property.propertyType} />
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
            surveyCard ? (
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
            )
          ) : null}

          {tab === "inspection" ? (
            <PropertyDetailInspectionTab
              property={property}
              inspectionTask={inspectionTask}
              inspectionCard={inspectionCard}
              editMode={inspectEdit}
              lockEditMode={workspaceForced && inspectorWorkspace?.forceEdit !== false}
              onEditModeChange={(edit) => {
                if (workspaceForced && !edit) {
                  inspectorWorkspace?.onCancel?.();
                  return;
                }
                setInspectEdit(edit);
                replaceInspectQuery(edit ? "edit" : null);
              }}
              onSubmitted={() => {
                void partySubmissionsQuery.refetch();
                inspectorWorkspace?.onSubmitted?.();
              }}
            />
          ) : null}

          {tab === "government" ? (
            <PropertyDetailGovernmentReviewsTab
              poNumber={poNumber}
              property={property}
            />
          ) : null}

          {tab === "report" ? (
            <PropertyDetailCaseStudyReport
              record={record}
              property={property}
              task={task ?? null}
            />
          ) : null}

          {tab === "appraisal" ? (
            <PropertyDetailAppraisalTab
              appraisalTaskId={appraisalTask?.id}
              appraisalCard={appraisalCard}
              submission={partySubmissionsQuery.data?.appraisal ?? null}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
              onReviewChanged={() => {
                void partySubmissionsQuery.refetch();
              }}
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
            )
          ) : null}

          {tab === "keys" ? (
            <PropertyDetailPropertyKeys
              poNumber={poNumber}
              property={property}
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
              sections={partyRemarksSections}
              loading={
                partySubmissionsQuery.isLoading ||
                partySubmissionsQuery.isFetching
              }
            />
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