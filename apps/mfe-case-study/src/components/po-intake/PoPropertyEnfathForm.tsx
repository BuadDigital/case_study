"use client";
import { useEffect, useRef, useState } from "react";
import {
  BOURSE_INQUIRY_IDENTIFIER_STATUS,
  DEED_NUMBER_DIGIT_LENGTH,
  isBourseInquiryIdentifier,
  requiresContacts,
  requiresRequestNumberField,
  requiredPropertyIdentifierDigitLength,
  sanitizePropertyIdentifierInput,
  showsCourtFields,
  type AssignmentType,
  type PoPropertyIntake,
  type PropertyIdentifierType,
} from "../../lib/prototype/po-intake-data";
import {
  cacheAssignmentDoc,
  cacheDeedOwnershipDoc,
  cacheDelegationDoc,
  cacheOtherPropertyDoc,
  cacheRegistryDoc,
  clearCachedPropertyDoc,
  clonePropertyDocumentsFromPrior,
  rememberPendingPriorDocumentClone,
  removeCachedPropertyDoc,
} from "../../lib/prototype/assignment-doc-attachments";
import {
  buildPropertyFromPriorDeed,
  findPriorDeedFull,
} from "../../lib/prototype/po-intake-storage";
import { RegField } from "@platform/app-shared/registration/FormFields";
import type { FieldErrors } from "@platform/app-shared/registration/registration-utils";
import {
  Badge,
  Card,
  CardBody,
  FormRow,
  Input,
  Label,
  Note,
  useToast,
} from "@platform/design-system";
import { PropertyFileUploadField } from "./PropertyFileUploadField";
import { PoContactEditor } from "./PoContactEditor";
import { CourtCircuitSelects } from "./CourtCircuitSelects";

type Props = {
  property: PoPropertyIntake;
  assignmentType: AssignmentType;
  fieldErrors: FieldErrors;
  onPatch: <K extends keyof PoPropertyIntake>(
    key: K,
    value: PoPropertyIntake[K],
  ) => void;
  /**
   * Preferred for full prior-deed populate (atomic replace).
   * Falls back to field-by-field onPatch when omitted.
   */
  onReplaceProperty?: (next: PoPropertyIntake) => void;
  poNumber?: string;
  excludePoNumber?: string;
  showStageNote?: boolean;
  /** Hide «حالة المسار / قيد الدراسة» for استعلام بورصة (e.g. primary-data panel). */
  hideBoursePathStatus?: boolean;
  /** When set, only render identifier type selector (for bourse-inquiry fast path). */
  fieldsMode?: "all" | "identifier-only" | "bourse-inquiry-primary";
};

export function PoPropertyEnfathForm({
  property,
  assignmentType,
  fieldErrors,
  onPatch,
  onReplaceProperty,
  poNumber,
  excludePoNumber,
  showStageNote = true,
  hideBoursePathStatus = false,
  fieldsMode = "all",
}: Props) {
  const { showToast } = useToast();
  const attachPo = poNumber?.trim() || excludePoNumber?.trim() || "";
  /** Current PO must never count as a "prior" registration (e.g. after phase revert). */
  const priorExcludePo = excludePoNumber?.trim() || poNumber?.trim() || undefined;
  const priorExcludePropertyId = property.id?.trim() || undefined;
  const [priorPo, setPriorPo] = useState<string | null>(null);
  const [priorFilled, setPriorFilled] = useState(false);
  /** One full auto-fill per propertyId + deed + prior PO (don't fight user edits). */
  const appliedPriorKeyRef = useRef<string | null>(null);
  const propertyRef = useRef(property);
  propertyRef.current = property;

  const showCourt = showsCourtFields(assignmentType);
  const showRequestNumber = requiresRequestNumberField(assignmentType);
  const contactsRequired = requiresContacts(assignmentType);
  const isBourseId = isBourseInquiryIdentifier(property.identifierType);
  const identifierDigitLength = requiredPropertyIdentifierDigitLength("deed");
  const realEstateRegDigitLength = requiredPropertyIdentifierDigitLength(
    "real_estate_reg",
  );
  const patchDeedNumber = (value: string) => {
    onPatch(
      "deedNumber",
      sanitizePropertyIdentifierInput(value, "deed"),
    );
  };
  const patchRealEstateRegNumber = (value: string) => {
    onPatch(
      "realEstateRegNumber",
      sanitizePropertyIdentifierInput(value, "real_estate_reg"),
    );
  };

  useEffect(() => {
    if (fieldsMode !== "all") return;
    const hasReg = property.realEstateRegNumber.trim().length > 0;
    const nextType: PropertyIdentifierType = hasReg
      ? "real_estate_reg"
      : "deed";
    if (property.identifierType === nextType) return;
    onPatch("identifierType", nextType);
  }, [
    fieldsMode,
    property.realEstateRegNumber,
    property.identifierType,
    onPatch,
  ]);

  useEffect(() => {
    const deed = property.deedNumber.trim();
    // Wait for a full deed number before looking up past POs (exact match).
    if (deed.length < DEED_NUMBER_DIGIT_LENGTH) {
      setPriorPo(null);
      setPriorFilled(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void findPriorDeedFull(deed, priorExcludePo, priorExcludePropertyId)
        .then(async (hit) => {
          if (cancelled) return;
          const hitPo = hit?.poNumber?.trim() || null;
          if (hitPo && priorExcludePo && hitPo === priorExcludePo) {
            setPriorPo(null);
            setPriorFilled(false);
            return;
          }
          setPriorPo(hitPo);
          if (!hit || !hitPo) {
            setPriorFilled(false);
            return;
          }

          const applyKey = `${property.id}|${deed}|${hitPo}`;
          if (appliedPriorKeyRef.current === applyKey) {
            setPriorFilled(true);
            return;
          }

          let next = buildPropertyFromPriorDeed(propertyRef.current, hit);

          // Clone PDF/image bytes onto this property (independent copies of prior attachments).
          const sourcePropId = hit.propertyId?.trim() ?? "";
          if (attachPo && property.id && sourcePropId && hitPo) {
            try {
              const cloned = await clonePropertyDocumentsFromPrior(
                hitPo,
                sourcePropId,
                attachPo,
                property.id,
              );
              if (cancelled) return;
              // First save may replace the client id with a server GUID — re-clone then.
              rememberPendingPriorDocumentClone(property.id, hitPo, sourcePropId);
              next = {
                ...next,
                assignmentDocFileNames:
                  cloned.assignmentDocFileNames.length > 0
                    ? cloned.assignmentDocFileNames
                    : next.assignmentDocFileNames,
                delegationLetterFileNames:
                  cloned.delegationLetterFileNames.length > 0
                    ? cloned.delegationLetterFileNames
                    : next.delegationLetterFileNames,
                otherDocumentFileNames:
                  cloned.otherDocumentFileNames.length > 0
                    ? cloned.otherDocumentFileNames
                    : next.otherDocumentFileNames,
                realEstateRegFileName:
                  cloned.realEstateRegFileName || next.realEstateRegFileName,
                deedOwnershipFileName:
                  cloned.deedOwnershipFileName || next.deedOwnershipFileName,
                bourseDeedImageFileName:
                  cloned.bourseDeedImageFileName || next.bourseDeedImageFileName,
              };
            } catch {
              /* keep file-name hints from prior DTO even if byte clone fails */
            }
          }
          if (cancelled) return;

          appliedPriorKeyRef.current = applyKey;
          if (onReplaceProperty) {
            onReplaceProperty(next);
          } else {
            const keys = Object.keys(next) as (keyof PoPropertyIntake)[];
            for (const key of keys) {
              if (key === "id") continue;
              onPatch(key, next[key] as never);
            }
          }
          setPriorFilled(true);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          showToast(
            err instanceof Error ? err.message : "تعذّر التحقق من الصك السابق",
            "error",
          );
          setPriorPo(null);
          setPriorFilled(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Autofill once per deed identity — not on every field change after user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [property.deedNumber, property.id, priorExcludePo, priorExcludePropertyId, attachPo, onPatch, onReplaceProperty, showToast]);

  const priorPoNotice = property.deedNumber.trim().length >= DEED_NUMBER_DIGIT_LENGTH
    ? priorPo
    : null;
  const isIdentifierOnly = fieldsMode === "identifier-only";
  const isPrimaryOnly = fieldsMode === "bourse-inquiry-primary";
  const showExtended = fieldsMode === "all" || isPrimaryOnly;
  const showBoursePrimary = isBourseId && showExtended;
  const showDeedFields = !isBourseId && fieldsMode === "all";
  const hasRealEstateReg = property.realEstateRegNumber.trim().length > 0;
  const hasRequestNumber = property.hasRequestNumber !== false;

  return (
    <>
      {showStageNote ? (
        <Note tone="info" className="mb-3">
          {isBourseId
            ? "مسار استعلام البورصة — أدخل البيانات الأولية وبيانات البورصة معاً."
            : hasRealEstateReg
              ? "بيانات مرحلة إنفاذ — مع التسجيل العيني يمكن تجاوز استعلام البورصة."
              : "بيانات مرحلة إنفاذ — يلزم رقم الصك أو التسجيل العيني (أو كلاهما)؛ بدون تسجيل عيني تُكمّل بيانات البورصة لاحقاً من «استعلام البورصة»."}
        </Note>
      ) : null}

      {isBourseId && !hideBoursePathStatus && !showBoursePrimary ? (
        <Card className="mb-3.5">
          <CardBody className="px-4 py-3.5">
            <Label className="mb-2 block text-[11px]">حالة المسار</Label>
            <Badge tone="warning" className="text-[13px] font-normal">
              {BOURSE_INQUIRY_IDENTIFIER_STATUS}
            </Badge>
          </CardBody>
        </Card>
      ) : hasRealEstateReg ? (
        <Note tone="success" className="mb-3">
          يمكن تجاوز استعلام البورصة والمتابعة مباشرة لتوزيع المعاملات.
        </Note>
      ) : null}

      {isIdentifierOnly ? null : (
      <>
      {priorPoNotice ? (
        <Note tone="success" className="mb-3">
          <strong>صك متكرر</strong> — وُجدت بيانات في أمر العمل «{priorPoNotice}».
          <span className="mt-1.5 block text-[12.5px] leading-relaxed text-text-2">
            {priorFilled
              ? "تم نسخ بيانات الدراسة السابقة بالكامل (بما فيها المستندات والـ PDF وخطابات التفويض) كأساس. عدّل ما تغيّر ثم احفظ — النسخة المحفوظة في هذه المعاملة هي المعتمدة؛ الدراسات السابقة تبقى للأرشيف والربط."
              : "جاري جلب ونسخ البيانات والمستندات السابقة…"}
          </span>
        </Note>
      ) : null}

      {showBoursePrimary ? (
        <FormRow>
          <RegField
            id="deed_number_bourse"
            label="رقم الصك"
            required
            dir="ltr"
            inputMode="numeric"
            maxLength={identifierDigitLength}
            hint={`${identifierDigitLength} أرقام`}
            value={property.deedNumber}
            error={fieldErrors.deedNumber}
            onChange={patchDeedNumber}
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
            id="assignment_mandate_number_bourse"
            label="رقم التكليف"
            required
            dir="ltr"
            value={property.assignmentMandateNumber}
            error={fieldErrors.assignmentMandateNumber}
            onChange={(v) => onPatch("assignmentMandateNumber", v)}
          />
          <RegField
            id="assignment_mandate_date_bourse"
            label="تاريخ التكليف"
            required
            type="date"
            value={property.assignmentMandateDate}
            error={fieldErrors.assignmentMandateDate}
            onChange={(v) => onPatch("assignmentMandateDate", v)}
          />
          {showRequestNumber ? (
            <RegField
              id="request_number_bourse"
              label="رقم الطلب"
              required
              dir="ltr"
              value={property.requestNumber}
              error={fieldErrors.requestNumber}
              onChange={(v) => onPatch("requestNumber", v)}
            />
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
            <RegField
              id="plan_number_bourse"
              label="رقم المخطط"
              dir="ltr"
              value={property.planNumber}
              error={fieldErrors.planNumber}
              onChange={(v) => onPatch("planNumber", v)}
            />
            <RegField
              id="plot_number_bourse"
              label="رقم القطعة"
              dir="ltr"
              value={property.plotNumber}
              error={fieldErrors.plotNumber}
              onChange={(v) => onPatch("plotNumber", v)}
            />
            <RegField
              id="plan_name_bourse"
              label="اسم المخطط"
              value={property.planName}
              error={fieldErrors.planName}
              onChange={(v) => onPatch("planName", v)}
            />
            <RegField
              id="block_number_bourse"
              label="رقم البلك"
              dir="ltr"
              value={property.blockNumber}
              error={fieldErrors.blockNumber}
              onChange={(v) => onPatch("blockNumber", v)}
            />
          </div>
          <RegField
            id="location_map_url_bourse"
            label="رابط موقع الخريطة"
            dir="ltr"
            hint="مطلوب للمناطق العشوائية (بدون مخطط وقطعة)"
            value={property.locationMapUrl}
            error={fieldErrors.locationMapUrl}
            onChange={(v) => onPatch("locationMapUrl", v)}
          />
          <RegField
            id="owner_name_bourse"
            label="اسم المالك"
            required
            value={property.ownerName}
            error={fieldErrors.ownerName}
            onChange={(v) => onPatch("ownerName", v)}
          />
          {showCourt ? (
            <CourtCircuitSelects
              courtId="court_bourse"
              circuitId="circuit_bourse"
              court={property.court}
              circuit={property.circuit}
              propertyCourtId={property.courtId}
              propertyCircuitId={property.circuitId}
              fieldErrors={fieldErrors}
              onPatch={onPatch}
            />
          ) : null}
        </FormRow>
      ) : showDeedFields ? (
      <FormRow>
        <RegField
          id="deed_number"
          label="رقم الصك"
          dir="ltr"
          inputMode="numeric"
          maxLength={identifierDigitLength}
          hint={`${identifierDigitLength} أرقام — مطلوب أحدهما على الأقل (صك أو تسجيل عيني)`}
          value={property.deedNumber}
          error={fieldErrors.deedNumber}
          onChange={patchDeedNumber}
        />
        <RegField
          id="deed_date"
          label="تاريخه"
          type="date"
          hint="اختياري"
          value={property.deedDate}
          error={fieldErrors.deedDate}
          onChange={(v) => onPatch("deedDate", v)}
        />
        <RegField
          id="real_estate_reg_number"
          label="تسجيل عيني"
          dir="ltr"
          inputMode="numeric"
          maxLength={realEstateRegDigitLength}
          hint={`${realEstateRegDigitLength} أرقام — مطلوب أحدهما على الأقل؛ عند التعبئة يتجاوز استعلام البورصة`}
          value={property.realEstateRegNumber}
          error={fieldErrors.realEstateRegNumber}
          onChange={patchRealEstateRegNumber}
        />
        <RegField
          id="real_estate_reg_date"
          label="تاريخه"
          required={hasRealEstateReg}
          type="date"
          value={property.realEstateRegDate}
          error={fieldErrors.realEstateRegDate}
          onChange={(v) => onPatch("realEstateRegDate", v)}
        />
        <div>
          <label
            htmlFor="deed_kind"
            className="mb-1 block text-[11px] font-semibold text-text-2"
          >
            نوع الصك
          </label>
          <select
            id="deed_kind"
            className="w-full rounded-lg border border-border-md bg-surface px-[11px] py-[7px] text-[12.5px] text-text"
            value={property.deedKind}
            onChange={(e) => onPatch("deedKind", e.target.value)}
          >
            <option value="">
              تلقائي — {property.suggestedDeedKind === "registered_title"
                ? "سجل عيني"
                : "صك تقليدي"}
            </option>
            <option value="traditional">صك تقليدي</option>
            <option value="registered_title">سجل عيني</option>
          </select>
        </div>
        <RegField
          id="assignment_mandate_number"
          label="رقم التكليف"
          required
          dir="ltr"
          value={property.assignmentMandateNumber}
          error={fieldErrors.assignmentMandateNumber}
          onChange={(v) => onPatch("assignmentMandateNumber", v)}
        />
        <RegField
          id="assignment_mandate_date"
          label="تاريخ التكليف"
          required
          type="date"
          value={property.assignmentMandateDate}
          error={fieldErrors.assignmentMandateDate}
          onChange={(v) => onPatch("assignmentMandateDate", v)}
        />
        <div className="w-full">
          {showRequestNumber ? (
            <>
              <label
                htmlFor="has_request_number"
                className="mb-1 flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-text-2"
              >
                <input
                  id="has_request_number"
                  type="checkbox"
                  className="size-3.5 accent-[var(--color-primary)]"
                  checked={hasRequestNumber}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    onPatch("hasRequestNumber", checked);
                    if (!checked) onPatch("requestNumber", "");
                  }}
                />
                <span>
                  رقم الطلب
                  {hasRequestNumber ? (
                    <span className="text-danger-text"> *</span>
                  ) : null}
                </span>
              </label>
              {hasRequestNumber ? (
                <>
                  <Input
                    id="request_number"
                    dir="ltr"
                    hasError={Boolean(fieldErrors.requestNumber)}
                    value={property.requestNumber}
                    onChange={(e) => onPatch("requestNumber", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.requestNumber)}
                    aria-describedby={
                      fieldErrors.requestNumber
                        ? "request_number-error"
                        : undefined
                    }
                  />
                  {fieldErrors.requestNumber ? (
                    <p
                      id="request_number-error"
                      className="mt-1 text-[10px] text-danger-text"
                      role="alert"
                    >
                      {fieldErrors.requestNumber}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="m-0 text-[10px] text-text-3">
                  لا يوجد رقم طلب — يمكن تجاوز الحقل
                </p>
              )}
            </>
          ) : (
            <p className="m-0 text-[10px] text-text-3">
              رقم الطلب لا ينطبق على هذا النوع من الإسناد (مرجع محكمة).
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
          <RegField
            id="plan_number"
            label="رقم المخطط"
            dir="ltr"
            value={property.planNumber}
            error={fieldErrors.planNumber}
            onChange={(v) => onPatch("planNumber", v)}
          />
          <RegField
            id="plot_number"
            label="رقم القطعة"
            dir="ltr"
            value={property.plotNumber}
            error={fieldErrors.plotNumber}
            onChange={(v) => onPatch("plotNumber", v)}
          />
          <RegField
            id="plan_name"
            label="اسم المخطط"
            value={property.planName}
            error={fieldErrors.planName}
            onChange={(v) => onPatch("planName", v)}
          />
          <RegField
            id="block_number"
            label="رقم البلك"
            dir="ltr"
            value={property.blockNumber}
            error={fieldErrors.blockNumber}
            onChange={(v) => onPatch("blockNumber", v)}
          />
        </div>
        <RegField
          id="location_map_url"
          label="رابط موقع الخريطة"
          dir="ltr"
          hint="مطلوب للمناطق العشوائية (بدون مخطط وقطعة)"
          value={property.locationMapUrl}
          error={fieldErrors.locationMapUrl}
          onChange={(v) => onPatch("locationMapUrl", v)}
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
          <CourtCircuitSelects
            courtId="court"
            circuitId="circuit"
            court={property.court}
            circuit={property.circuit}
            propertyCourtId={property.courtId}
            propertyCircuitId={property.circuitId}
            fieldErrors={fieldErrors}
            onPatch={onPatch}
          />
        ) : null}
      </FormRow>
      ) : null}

      {!isBourseId && fieldsMode === "all" ? (
        <PropertyFileUploadField
          id={`delegation_${property.id}`}
          label="خطاب التفويض *"
          fileNames={property.delegationLetterFileNames}
          error={fieldErrors.delegationLetterFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="delegation"
          multiple
          maxFiles={1}
          onTooManyFiles={() =>
            showToast("ممنوع إدخال أكثر من مستند واحد", "error")
          }
          onUpload={(file) => {
            onPatch("delegationLetterFileNames", [file.name]);
            if (attachPo) {
              void cacheDelegationDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast("تعذّر حفظ مرفق التفويض — حاول مرة أخرى", "error");
                });
            }
          }}
          onRemove={(name) => {
            onPatch(
              "delegationLetterFileNames",
              property.delegationLetterFileNames.filter((n) => n !== name),
            );
            if (attachPo) {
              void removeCachedPropertyDoc(
                "delegation",
                attachPo,
                property.id,
                name,
              );
            }
          }}
          onClear={() => onPatch("delegationLetterFileNames", [])}
        />
      ) : null}

      {hasRealEstateReg && fieldsMode === "all" ? (
        <PropertyFileUploadField
          id={`real_estate_reg_${property.id}`}
          label="السجل العقاري (مرفق) *"
          fileName={property.realEstateRegFileName}
          error={fieldErrors.realEstateRegFileName}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="registry"
          onUpload={(file) => {
            onPatch("realEstateRegFileName", file.name);
            if (attachPo) {
              void cacheRegistryDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ مرفق السجل العقاري — حاول مرة أخرى",
                    "error",
                  );
                });
            }
          }}
          onClear={() => {
            onPatch("realEstateRegFileName", "");
            if (attachPo) {
              clearCachedPropertyDoc("registry", attachPo, property.id);
            }
          }}
        />
      ) : null}

      {showExtended ? (
        <PropertyFileUploadField
          id={`assignment_doc_${property.id}`}
          label={<>خطاب الإسناد *</>}
          fileNames={property.assignmentDocFileNames}
          error={fieldErrors.assignmentDocFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="decree"
          multiple
          maxFiles={1}
          onTooManyFiles={() =>
            showToast("ممنوع إدخال أكثر من مستند واحد", "error")
          }
          onUpload={(file) => {
            onPatch("assignmentDocFileNames", [file.name]);
            if (attachPo) {
              void cacheAssignmentDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ مرفق خطاب الإسناد — حاول مرة أخرى",
                    "error",
                  );
                });
            }
          }}
          onRemove={(name) => {
            onPatch(
              "assignmentDocFileNames",
              property.assignmentDocFileNames.filter((n) => n !== name),
            );
            if (attachPo) {
              void removeCachedPropertyDoc("decree", attachPo, property.id, name);
            }
          }}
          onClear={() => onPatch("assignmentDocFileNames", [])}
        />
      ) : null}

      {showExtended ? (
        <PropertyFileUploadField
          id={`deed_ownership_${property.id}`}
          label="صورة وثيقة التملك (الصك) (اختياري)"
          fileName={property.deedOwnershipFileName}
          error={fieldErrors.deedOwnershipFileName}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="deed"
          onUpload={(file) => {
            onPatch("deedOwnershipFileName", file.name);
            if (attachPo) {
              void cacheDeedOwnershipDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ صورة وثيقة التملك — حاول مرة أخرى",
                    "error",
                  );
                });
            }
          }}
          onClear={() => {
            onPatch("deedOwnershipFileName", "");
            if (attachPo) {
              clearCachedPropertyDoc("deed", attachPo, property.id);
            }
          }}
        />
      ) : null}

      {fieldsMode === "all" || isPrimaryOnly ? (
        <PropertyFileUploadField
          id={`other_docs_${property.id}`}
          label="مستندات أخرى (اختياري)"
          fileNames={property.otherDocumentFileNames}
          attachPo={attachPo}
          propertyId={property.id}
          docKind="other"
          multiple
          onUpload={(file) => {
            onPatch("otherDocumentFileNames", [
              ...property.otherDocumentFileNames,
              file.name,
            ]);
            if (attachPo) {
              void cacheOtherPropertyDoc(attachPo, property.id, file)
                .then((result) => {
                  if (!result.ok) showToast(result.error, "error");
                })
                .catch(() => {
                  showToast(
                    "تعذّر حفظ المستند الإضافي — حاول مرة أخرى",
                    "error",
                  );
                });
            }
          }}
          onRemove={(name) => {
            onPatch(
              "otherDocumentFileNames",
              property.otherDocumentFileNames.filter((n) => n !== name),
            );
            if (attachPo) {
              void removeCachedPropertyDoc("other", attachPo, property.id, name);
            }
          }}
          onClear={() => onPatch("otherDocumentFileNames", [])}
        />
      ) : null}

      {showExtended ? (
      <div id="po_contacts_section" className="mt-5">
        <h3 className="mb-2.5 text-[13px] font-bold">
          ضباط الاتصال
          {contactsRequired ? (
            <span className="text-danger-text"> *</span>
          ) : (
            <span className="ms-1 text-[11px] font-normal text-text-3">
              (اختياري)
            </span>
          )}
        </h3>
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
