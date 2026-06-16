"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BOURSE_INQUIRY_IDENTIFIER_STATUS,
  CLASSIFICATION_OPTIONS,
  isBourseInquiryIdentifier,
  PROPERTY_CLASSIFICATIONS,
  requiresAssignmentDecree,
  showsCourtFields,
  type AssignmentType,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../../lib/prototype/po-intake-data";
import {
  cacheAssignmentDoc,
  cacheDelegationDoc,
} from "../../lib/prototype/assignment-doc-attachments";
import { findPriorDeedFull } from "../../lib/prototype/po-intake-storage";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  Badge,
  Card,
  CardBody,
  cn,
  FormRow,
  Input,
  Label,
  Note,
} from "@platform/design-system";
import { AssignmentDocAttachment } from "./AssignmentDocAttachment";
import { PoContactEditor } from "./PoContactEditor";

type Props = {
  property: PoPropertyIntake;
  propertyOrdinal?: number;
  assignmentType: AssignmentType;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
  poNumber?: string;
  excludePoNumber?: string;
  showStageNote?: boolean;
  /** Hide «حالة المسار / قيد الدراسة» for استعلام بورصة (e.g. primary-data panel). */
  hideBoursePathStatus?: boolean;
  /** When set, only render identifier type selector (for bourse-inquiry fast path). */
  fieldsMode?: "all" | "identifier-only" | "bourse-inquiry-primary";
};

const pillClass = (selected: boolean) =>
  cn(
    "inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-DEFAULT)] border-2 px-4 py-2 font-[inherit] text-xs font-semibold transition-all",
    selected
      ? "border-primary bg-primary text-white shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
      : "border-border bg-surface text-text-2 hover:border-primary-light hover:text-primary",
  );

function selectIdentifierType(
  onPatch: Props["onPatch"],
  type: PropertyIdentifierType,
) {
  onPatch("identifierType", type);
  if (type === "bourse_inquiry") {
    onPatch("delegationLetterFileName", "");
  } else if (type === "deed" || type === "real_estate_reg") {
    onPatch("city", "");
  }
}

export function PoPropertyEnfathForm({
  property,
  propertyOrdinal,
  assignmentType,
  fieldErrors,
  onPatch,
  poNumber,
  excludePoNumber,
  showStageNote = true,
  hideBoursePathStatus = false,
  fieldsMode = "all",
}: Props) {
  const attachPo = poNumber?.trim() || excludePoNumber?.trim() || "";
  const [priorPo, setPriorPo] = useState<string | null>(null);
  const showAssignmentDecree = requiresAssignmentDecree(assignmentType);
  const showCourt = showsCourtFields(assignmentType);
  const isBourseId = isBourseInquiryIdentifier(property.identifierType);
  const propertyTypes = useMemo(() => {
    const c = property.classification;
    return c ? (PROPERTY_CLASSIFICATIONS[c] ?? []) : [];
  }, [property.classification]);

  useEffect(() => {
    const deed = property.deedNumber.trim();
    if (!deed) return;
    let cancelled = false;
    void findPriorDeedFull(deed, excludePoNumber).then((hit) => {
      if (cancelled) return;
      setPriorPo(hit?.poNumber ?? null);
      if (hit) {
        if (hit.deedDate && !property.deedDate) onPatch("deedDate", hit.deedDate);
        if (hit.ownerName && !property.ownerName) onPatch("ownerName", hit.ownerName);
        if (hit.contacts?.length && property.contacts.every((c) => !c.phone)) {
          onPatch(
            "contacts",
            hit.contacts.map((c) => ({
              name: c.name ?? "",
              role: c.role ?? "",
              phone: c.phone ?? "",
            })),
          );
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    property.deedNumber,
    excludePoNumber,
    isBourseId,
    property.deedDate,
    property.ownerName,
    property.contacts,
    onPatch,
  ]);

  const priorPoNotice = property.deedNumber.trim() ? priorPo : null;
  const isIdentifierOnly = fieldsMode === "identifier-only";
  const isPrimaryOnly = fieldsMode === "bourse-inquiry-primary";
  const showExtended = fieldsMode === "all" || isPrimaryOnly;
  const showBoursePrimary = isBourseId && showExtended;
  const showDeedFields = !isBourseId && fieldsMode === "all";

  return (
    <>
      {showStageNote ? (
        <Note tone="info" className="mb-3">
          {isBourseId
            ? "مسار استعلام البورصة — أدخل البيانات الأولية وبيانات البورصة معاً."
            : "بيانات مرحلة إنفاذ — تُكمّل بيانات البورصة (المدينة، التصنيف، الحدود) لاحقاً من «استعلام البورصة»."}
        </Note>
      ) : null}

      <div className="mb-3 w-full">
        <Label className="mb-1 text-[11px]">مصدر البيانات</Label>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={pillClass(property.identifierType === "deed")}
            onClick={() => selectIdentifierType(onPatch, "deed")}
          >
            صك ملكية
          </button>
          <button
            type="button"
            className={pillClass(property.identifierType === "real_estate_reg")}
            onClick={() => selectIdentifierType(onPatch, "real_estate_reg")}
          >
            تسجيل عيني
          </button>
          <button
            type="button"
            className={pillClass(property.identifierType === "bourse_inquiry")}
            onClick={() => selectIdentifierType(onPatch, "bourse_inquiry")}
          >
            البورصة العقاريه
          </button>
        </div>
      </div>

      {isBourseId && !hideBoursePathStatus && !showBoursePrimary ? (
        <Card className="mb-3.5">
          <CardBody className="px-4 py-3.5">
            <Label className="mb-2 block text-[11px]">حالة المسار</Label>
            <Badge tone="warning" className="text-[13px] font-normal">
              {BOURSE_INQUIRY_IDENTIFIER_STATUS}
            </Badge>
          </CardBody>
        </Card>
      ) : property.identifierType === "real_estate_reg" ? (
        <Note tone="warn" className="mb-3">
          لا يمكن الاستعلام من بورصة العقارات — يطلب الأخصائي السجل العقاري من
          أطراف التنفيذ ويرفعه كمرفق.
        </Note>
      ) : null}

      {isIdentifierOnly ? null : (
      <>
      {!isBourseId && priorPoNotice ? (
        <Note tone="success" className="mb-3">
          هذا الصك مسجّل سابقاً في أمر العمل «{priorPoNotice}» — يمكن استخدام بيانات
          الاتصال السابقة.
        </Note>
      ) : null}

      {isBourseId && priorPoNotice ? (
        <Note tone="success" className="mb-3">
          هذا الصك مسجّل سابقاً في أمر العمل «{priorPoNotice}».
        </Note>
      ) : null}

      {showBoursePrimary ? (
        <FormRow>
          <RegField
            id="deed_number_bourse"
            label="رقم الصك"
            required
            dir="ltr"
            value={property.deedNumber}
            error={fieldErrors.deedNumber}
            onChange={(v) => onPatch("deedNumber", v)}
          />
          <RegField
            id="task_number_bourse"
            label="رقم المهمة"
            required
            dir="ltr"
            value={property.taskNumber}
            error={fieldErrors.taskNumber}
            onChange={(v) => onPatch("taskNumber", v)}
          />
          <RegField
            id="deed_date_bourse"
            label="تاريخ الصك"
            required
            type="date"
            value={property.deedDate}
            error={fieldErrors.deedDate}
            onChange={(v) => onPatch("deedDate", v)}
          />
          <RegField
            id="owner_name_bourse"
            label="اسم المالك"
            required
            value={property.ownerName}
            error={fieldErrors.ownerName}
            onChange={(v) => onPatch("ownerName", v)}
          />
          <RegField
            id="court_bourse"
            label="المحكمة"
            required
            value={property.court}
            error={fieldErrors.court}
            onChange={(v) => onPatch("court", v)}
          />
          <RegField
            id="circuit_bourse"
            label="الدائرة"
            required
            value={property.circuit}
            error={fieldErrors.circuit}
            onChange={(v) => onPatch("circuit", v)}
          />
        </FormRow>
      ) : showDeedFields ? (
      <FormRow>
        <RegField
          id="deed_number"
          label={
            property.identifierType === "real_estate_reg"
              ? "رقم التسجيل العيني"
              : "رقم الصك"
          }
          required
          dir="ltr"
          value={property.deedNumber}
          error={fieldErrors.deedNumber}
          onChange={(v) => onPatch("deedNumber", v)}
        />
        <RegField
          id="task_number"
          label="رقم المهمة"
          required
          dir="ltr"
          value={property.taskNumber}
          error={fieldErrors.taskNumber}
          onChange={(v) => onPatch("taskNumber", v)}
        />
        <RegField
          id="deed_date"
          label="تاريخ الصك"
          required
          type="date"
          value={property.deedDate}
          error={fieldErrors.deedDate}
          onChange={(v) => onPatch("deedDate", v)}
        />
        <RegField
          id="owner_name"
          label="اسم المالك"
          required
          value={property.ownerName}
          error={fieldErrors.ownerName}
          onChange={(v) => onPatch("ownerName", v)}
        />
        {showCourt ? (
          <>
            <RegField
              id="court"
              label="المحكمة"
              value={property.court}
              onChange={(v) => onPatch("court", v)}
            />
            <RegField
              id="circuit"
              label="الدائرة"
              value={property.circuit}
              onChange={(v) => onPatch("circuit", v)}
            />
          </>
        ) : null}
      </FormRow>
      ) : null}

      {!isBourseId && fieldsMode === "all" ? (
      <div className="mt-2 w-full">
        <Label className="mb-1 text-[11px]" htmlFor={`delegation_${property.id}`}>
          خطاب التفويض *
        </Label>
        <Input
          id={`delegation_${property.id}`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            onPatch("delegationLetterFileName", file?.name ?? "");
            if (file && attachPo) {
              void cacheDelegationDoc(attachPo, property.id, file);
            }
          }}
        />
        {fieldErrors.delegationLetterFileName ? (
          <p className="mt-1 text-[10px] text-danger-text" role="alert">
            {fieldErrors.delegationLetterFileName}
          </p>
        ) : property.delegationLetterFileName ? (
          <p className="mt-1 text-[10px] text-text-3">
            {property.delegationLetterFileName}
          </p>
        ) : null}
      </div>
      ) : null}

      {property.identifierType === "real_estate_reg" && fieldsMode === "all" ? (
        <div className="mt-2 w-full">
          <Label className="mb-1 text-[11px]" htmlFor={`real_estate_reg_${property.id}`}>
            السجل العقاري (مرفق) *
          </Label>
          <Input
            id={`real_estate_reg_${property.id}`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onPatch("realEstateRegFileName", file?.name ?? "");
            }}
          />
          {fieldErrors.realEstateRegFileName ? (
            <p className="mt-1 text-[10px] text-danger-text" role="alert">
              {fieldErrors.realEstateRegFileName}
            </p>
          ) : property.realEstateRegFileName ? (
            <p className="mt-1 text-[10px] text-text-3">
              {property.realEstateRegFileName}
            </p>
          ) : null}
        </div>
      ) : null}

      {showAssignmentDecree && showExtended ? (
        <div className="mt-2 w-full">
          <Label className="mb-1 text-[11px]" htmlFor={`assignment_doc_${property.id}`}>
            قرار الإسناد
            {propertyOrdinal ? ` (${propertyOrdinal})` : ""} *
          </Label>
          <Input
            id={`assignment_doc_${property.id}`}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="text-xs"
            onChange={(e) => {
              const file = e.target.files?.[0];
              onPatch("assignmentDocFileName", file?.name ?? "");
              if (file && attachPo) {
                void cacheAssignmentDoc(attachPo, property.id, file);
              }
            }}
          />
          {property.assignmentDocFileName && attachPo ? (
            <AssignmentDocAttachment
              poNumber={attachPo}
              propertyId={property.id}
              fileName={property.assignmentDocFileName}
              variant="inline"
            />
          ) : fieldErrors.assignmentDocFileName ? (
            <p className="mt-1 text-[10px] text-danger-text" role="alert">
              {fieldErrors.assignmentDocFileName}
            </p>
          ) : null}
        </div>
      ) : null}

      {fieldsMode === "all" ? (
      <div className="mt-2 w-full">
        <Label className="mb-1 text-[11px]" htmlFor={`other_docs_${property.id}`}>
          مستندات أخرى (اختياري)
        </Label>
        <Input
          id={`other_docs_${property.id}`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          className="text-xs"
          onChange={(e) => {
            const names = Array.from(e.target.files ?? []).map((f) => f.name);
            onPatch("otherDocumentFileNames", names);
          }}
        />
        {property.otherDocumentFileNames.length > 0 ? (
          <p className="mt-1 text-[10px] text-text-3">
            {property.otherDocumentFileNames.join("، ")}
          </p>
        ) : null}
      </div>
      ) : null}

      {showExtended ? (
      <div className="mt-5">
        <h3 className="mb-2.5 text-[13px] font-bold">ضباط الاتصال</h3>
        {fieldErrors._contacts ? (
          <Note tone="warn" className="mb-3">
            {fieldErrors._contacts}
          </Note>
        ) : null}
        <PoContactEditor
          contacts={property.contacts}
          errors={fieldErrors}
          onChange={(contacts) => onPatch("contacts", contacts)}
        />
      </div>
      ) : null}
      </>
      )}
    </>
  );
}
