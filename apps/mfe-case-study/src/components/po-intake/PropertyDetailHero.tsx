"use client";

import { cn } from "@platform/design-system";
import { PoNumber } from "../ui/PoNumber";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";
import {
  formatDateAr,
  formatPropertyLocation,
  formatPropertyTypeLine,
  identifierTypeLabel,
  showsCourtFields,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";

function deedTitle(property: { deedNumber: string }): string {
  return property.deedNumber.trim() || "—";
}

function isDueSoon(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10));
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function BuildingIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
    </svg>
  );
}

export function PropertyDetailHero({
  record,
  property,
  propertyIndex,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** 1-based index in PO properties list */
  propertyIndex: number;
}) {
  const titleDeed = deedTitle(property);
  const locationLine = formatPropertyLocation(property);
  const typeLine = formatPropertyTypeLine(property);
  const courtLine = [property.court, property.circuit]
    .filter(Boolean)
    .join(" · ");
  const dueUrgent = record.dueDateAt ? isDueSoon(record.dueDateAt) : false;

  return (
    <header className="shrink-0 border-b border-border/50 bg-surface px-6 pt-4 pb-0">
      <div className="mb-2.5 flex items-start justify-between gap-4 max-[900px]:flex-col">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-3">
            <BuildingIcon />
            عقار {propertyIndex} من {record.properties.length} في{" "}
            <PoNumber value={record.poNumber} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xl leading-snug font-semibold text-text">
            <span>
              صك رقم{" "}
              <bdi dir="ltr" className={ltrValueClass}>
                {titleDeed}
              </bdi>
            </span>
            <DetailBadge tone="teal">
              {identifierTypeLabel(property.identifierType)}
            </DetailBadge>
            <DetailBadge tone="amber">{record.assignmentType}</DetailBadge>
          </div>
        </div>
        <div className="shrink-0 text-end max-[900px]:w-full max-[900px]:text-start">
          <div className="max-[900px]:text-start">
            <div className="mb-0.5 text-[11px] text-text-3">رقم المهمة</div>
            <div className="text-[22px] font-semibold text-primary">
              <bdi dir="ltr" className={ltrValueClass}>
                {property.taskNumber.trim() || "—"}
              </bdi>
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex flex-nowrap gap-0 overflow-x-auto pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:h-0"
        aria-label="ملخص العقار"
      >
        <div className="shrink-0 py-1 pe-4 ps-0">
          <div className="mb-0.5 text-[11px] text-text-3">اسم المالك</div>
          <div className="text-[13px] font-medium text-text">
            {property.ownerName.trim() || "—"}
          </div>
        </div>
        <div className="shrink-0 border-s border-border/50 py-1 px-4">
          <div className="mb-0.5 text-[11px] text-text-3">المدينة / الحي</div>
          <div className="text-[13px] font-medium text-text">
            {locationLine || "—"}
          </div>
        </div>
        <div className="shrink-0 border-s border-border/50 py-1 px-4">
          <div className="mb-0.5 text-[11px] text-text-3">التصنيف</div>
          <div className="text-[13px] font-medium text-text">
            {typeLine || "—"}
          </div>
        </div>
        <div className="shrink-0 border-s border-border/50 py-1 px-4">
          <div className="mb-0.5 text-[11px] text-text-3">المساحة</div>
          <div className="text-[13px] font-medium text-text">
            {property.area.trim() ? `${property.area.trim()} م²` : "—"}
          </div>
        </div>
        {showsCourtFields(record.assignmentType) ? (
          <div className="shrink-0 border-s border-border/50 py-1 px-4">
            <div className="mb-0.5 text-[11px] text-text-3">المحكمة / الدائرة</div>
            <div className="text-[13px] font-medium text-text">
              {courtLine || "—"}
            </div>
          </div>
        ) : null}
        <div className="shrink-0 border-s border-border/50 py-1 px-4">
          <div className="mb-0.5 text-[11px] text-text-3">تاريخ الاستحقاق</div>
          <div
            className={cn(
              "text-[13px] font-medium text-text",
              dueUrgent && "text-danger-text",
            )}
          >
            {record.dueDateAt ? (
              <bdi dir="ltr" className={ltrValueClass}>
                {formatDateAr(record.dueDateAt)}
              </bdi>
            ) : (
              "—"
            )}
          </div>
        </div>
        <div className="shrink-0 border-s border-border/50 py-1 px-4">
          <div className="mb-0.5 text-[11px] text-text-3">استلام إنفاذ</div>
          <div className="text-[13px] font-medium text-text">
            {record.receivedFromEnfathAt ? (
              <bdi dir="ltr" className={ltrValueClass}>
                {formatDateAr(record.receivedFromEnfathAt)}
              </bdi>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
