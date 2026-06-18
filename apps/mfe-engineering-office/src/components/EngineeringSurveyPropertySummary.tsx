"use client";

import type { PoPropertyIntake } from "@case-study/mfe";
import {
  boundariesAvailabilityLabel,
  formatPropertyDeedDisplay,
  restrictionsPresentLabel,
  showsCourtFields,
  type PoIntakeRecord,
} from "@case-study/mfe";
import { Badge, InlineLoadingSkeleton } from "@platform/design-system";
import {
  FieldBox,
  FieldsGrid,
  InfoBox,
  SectionDivider,
  SectionHeader,
} from "@case-study/mfe/components/po-intake/PropertyDetailFields";

export function EngineeringSurveyPropertySummary({
  property,
  record,
}: {
  property: PoPropertyIntake | undefined;
  record?: PoIntakeRecord;
}) {
  if (!property) {
    return <InlineLoadingSkeleton />;
  }

  const deedLabel = formatPropertyDeedDisplay(property);
  const restrictions = restrictionsPresentLabel(property.restrictionsPresent);
  const courtLine = [property.court, property.circuit]
    .filter(Boolean)
    .join(" · ");
  const showCourt =
    record != null && showsCourtFields(record.assignmentType);

  return (
    <>
      <SectionHeader>بيانات الصك</SectionHeader>
      <FieldsGrid>
        <FieldBox label="رقم الصك" value={deedLabel} ltr />
        <FieldBox label="تاريخ الصك" value={property.deedDate} ltr />
        <FieldBox label="حالة الصك">
          {property.deedStatus.trim() ? (
            <Badge tone="primary" className="border-0 text-[11px] font-normal">
              {property.deedStatus}
            </Badge>
          ) : null}
        </FieldBox>
        <FieldBox label="اسم المالك" value={property.ownerName} />
        <FieldBox label="حالة الملك" value={property.deedStatus} />
        <FieldBox
          label="القيود على العقار"
          value={restrictions}
          emptyLabel="لا توجد قيود"
        />
      </FieldsGrid>

      <SectionDivider />
      <SectionHeader>بيانات الموقع</SectionHeader>
      <FieldsGrid>
        <FieldBox label="المدينة" value={property.city} />
        <FieldBox label="الحي" value={property.district} />
        {showCourt ? (
          <FieldBox label="المحكمة / الدائرة" value={courtLine} />
        ) : null}
        <FieldBox
          label="توفر الحدود"
          value={boundariesAvailabilityLabel(property.boundariesAvailability)}
        />
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
        <FieldBox label="رقم المهمة" value={property.taskNumber} ltr />
      </FieldsGrid>
    </>
  );
}
