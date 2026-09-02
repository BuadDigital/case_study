"use client";

/**
 * Case Study.html «البيانات الأساسية» — media glance + fieldBox sections.
 */

import { cn } from "@platform/ui-kit";
import {
  boundariesAvailabilityLabel,
  boundariesMarkedUnavailable,
  formatDateAr,
  formatPropertyRestrictionsLine,
  hasBourseDetailFields,
  ownershipStatusLabel,
  showsCourtFields,
  skipsBourseForIdentifier,
  PROPERTY_BOUNDARY_ROWS,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { isValidContactEntry } from "../../lib/domain/po-intake/property-validation";
import type { PropertyDetailDocumentEntry } from "../../lib/app-data/property-detail-documents";
import { PropertyDetailMediaGlance } from "./PropertyDetailMediaGlance";
import {
  DetailBadge,
  FieldBox,
  FieldsGrid,
  InfoBox,
  ltrValueClass,
  SectionHeader,
} from "./PropertyDetailFields";

function BoundariesTable({
  property,
}: {
  property: PoPropertyIntake;
}) {
  const rows = PROPERTY_BOUNDARY_ROWS.map((row) => ({
    label: row.label,
    desc: property[row.descKey].trim(),
    len: property[row.lenKey].trim(),
  }));

  return (
    <div className="overflow-hidden rounded border border-border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-start text-[11px] font-bold text-text-2">
              الحد
            </th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-center text-[11px] font-bold text-text-2">
              وصف الحد
            </th>
            <th className="border-b border-border bg-surface-2 px-3 py-2 text-center text-[11px] font-bold text-text-2">
              طول الضلع
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.label}>
              <td
                className={cn(
                  "px-3 py-2 font-semibold text-heading",
                  i < rows.length - 1 && "border-b border-border",
                )}
              >
                {row.label}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-center text-text",
                  i < rows.length - 1 && "border-b border-border",
                )}
              >
                {row.desc || "—"}
              </td>
              <td
                className={cn(
                  "px-3 py-2 text-center tabular-nums text-text [direction:ltr]",
                  i < rows.length - 1 && "border-b border-border",
                )}
              >
                {row.len ? `${row.len} م` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PropertyDetailBasicTab({
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
  const hasBoundaryRows = PROPERTY_BOUNDARY_ROWS.some(
    (row) => property[row.descKey].trim() || property[row.lenKey].trim(),
  );
  const boundariesUnavailable = boundariesMarkedUnavailable(
    property.boundariesAvailability,
  );
  const boundariesAwaiting =
    !boundariesUnavailable && !hasBoundaryRows && !property.bourseDataCompleted;

  return (
    <div className="flex flex-col gap-0">
      <PropertyDetailMediaGlance
        property={property}
        primaryPhoto={primaryPhoto}
      />

      <SectionHeader divider>بيانات الصك</SectionHeader>
      <FieldsGrid>
        <FieldBox label="رقم أمر العمل" value={record.poNumber} ltr />
        <FieldBox label="رقم الصك" value={property.deedNumber} ltr />
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

      <SectionHeader divider>بيانات الموقع</SectionHeader>
      <FieldsGrid>
        <FieldBox label="المدينة" value={property.city} />
        <FieldBox label="الحي" value={property.district} />
        {showsCourtFields(record.assignmentType) ? (
          <FieldBox label="المحكمة / الدائرة" value={courtLine} />
        ) : null}
        <FieldBox label="رقم المخطط" value={property.planNumber} ltr />
        <FieldBox label="رقم القطعة" value={property.plotNumber} ltr />
        <FieldBox
          label="محضر التجزئة"
          value={[property.partitionMinutesNumber, property.partitionMinutesDate]
            .map((x) => x.trim())
            .filter(Boolean)
            .join(" · ")}
          ltr
        />
      </FieldsGrid>

      <SectionHeader divider>البيانات المساحية</SectionHeader>
      <FieldsGrid cols={3}>
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
        <InfoBox variant="amber" icon="ℹ">
          بانتظار بيانات البورصة — تُعرض حدود العقار وأطوال أضلاعه بعد اكتمال
          الاستعلام.
        </InfoBox>
      ) : hasBoundaryRows ? (
        <>
          <BoundariesTable property={property} />
          <p className="mt-1.5 mb-0 text-[10.5px] text-text-3">
            «بطول» = طول ضلع العقار على ذلك الحد. المصدر: البورصة العقارية /
            الصك.
          </p>
        </>
      ) : (
        <InfoBox icon="ℹ">لم تُسجَّل حدود وأطوال بعد.</InfoBox>
      )}

      <SectionHeader divider>بيانات الاتصال</SectionHeader>
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
          <SectionHeader divider>
            بيانات الاستعلام — البورصة العقارية
          </SectionHeader>
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
    </div>
  );
}
