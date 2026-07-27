"use client";

import type { PoPropertyIntake } from "@case-study/mfe";
import {
  boundariesAvailabilityLabel,
  formatPropertyDeedDisplay,
  restrictionsPresentLabel,
  showsCourtFields,
  type PoIntakeRecord,
} from "@case-study/mfe";
import { InlineLoadingSkeleton } from "@platform/design-system";
import {
  EngField,
  EngSection,
  EngStatusPill,
  ENG_STATUS_COLORS,
} from "./EngineeringSurveyHtmlPrimitives";

export function EngineeringSurveyPropertySummary({
  property,
  record,
  deedNumber,
}: {
  property: PoPropertyIntake | undefined;
  record?: PoIntakeRecord;
  deedNumber?: string;
}) {
  if (!property) {
    return <InlineLoadingSkeleton />;
  }

  const deedLabel =
    formatPropertyDeedDisplay(property) || deedNumber?.trim() || "—";
  const restrictions = restrictionsPresentLabel(property.restrictionsPresent);
  const courtLine =
    [property.court, property.circuit].filter(Boolean).join(" / ") || "—";
  const showCourt =
    record != null && showsCourtFields(record.assignmentType);

  return (
    <>
      <EngSection>بيانات الصك</EngSection>
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <EngField label="رقم الصك" value={deedLabel} ltr />
        <EngField label="تاريخ الصك" value={property.deedDate || "—"} ltr />
        <EngField label="حالة الصك">
          {property.deedStatus.trim() ? (
            <EngStatusPill
              label={property.deedStatus}
              color={ENG_STATUS_COLORS.submitted}
            />
          ) : (
            "—"
          )}
        </EngField>
        <EngField label="اسم المالك" value={property.ownerName || "—"} />
        <EngField label="حالة الملك" value={property.deedStatus || "—"} />
        <EngField
          label="القيود على العقار"
          value={restrictions || "لا توجد قيود"}
        />
      </div>

      <EngSection>بيانات الموقع</EngSection>
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <EngField label="المدينة" value={property.city || "—"} />
        <EngField label="الحي" value={property.district || "—"} />
        {showCourt ? (
          <EngField label="المحكمة / الدائرة" value={courtLine} />
        ) : (
          <EngField label="المحكمة / الدائرة" value="—" />
        )}
        <EngField label="رقم المخطط" value={property.planNumber || "—"} ltr />
        <EngField label="رقم القطعة" value={property.plotNumber || "—"} ltr />
        <EngField
          label="توفر الحدود"
          value={
            boundariesAvailabilityLabel(property.boundariesAvailability) || "—"
          }
        />
      </div>

      <EngSection>البيانات المساحية</EngSection>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <EngField label="التصنيف" value={property.classification || "—"} />
        <EngField
          label="النوع / الاستخدام"
          value={property.propertyType || "—"}
        />
        <EngField
          label="المساحة الإجمالية"
          value={
            property.area.trim() ? `${property.area.trim()} م²` : "—"
          }
        />
        <EngField
          label="رقم الطلب"
          value={property.requestNumber || "—"}
          ltr
        />
        <EngField
          label="رقم التكليف"
          value={property.assignmentMandateNumber || "—"}
          ltr
        />
        <EngField
          label="تاريخ التكليف"
          value={property.assignmentMandateDate || "—"}
          ltr
        />
      </div>
    </>
  );
}
