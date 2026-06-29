"use client";

import { Badge } from "@platform/design-system";
import {
  boundariesAvailabilityLabel,
  formatPropertyDeedDisplay,
  formatPropertyLocation,
  formatPropertyTypeLine,
  hasBourseDetailFields,
  restrictionsPresentLabel,
  showsCourtFields,
  skipsBourseForIdentifier,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { isValidContactEntry } from "../../lib/domain/po-intake/property-validation";
import { AssignmentDocAttachment } from "./AssignmentDocAttachment";
import { PoPropertyDetailTabs } from "./PoPropertyDetailTabs";

export function PoDetailPropertyCard({
  index,
  property,
  poNumber,
  assignmentType,
  showDecree,
  layout = "compact",
  record,
}: {
  index: number;
  property: PoPropertyIntake;
  poNumber: string;
  assignmentType: PoIntakeRecord["assignmentType"];
  showDecree: boolean;
  layout?: "compact" | "page";
  /** Required for page layout (tabs + timeline). */
  record?: PoIntakeRecord;
}) {
  const contactCount = property.contacts.filter((c) =>
    isValidContactEntry(c),
  ).length;
  const boursePending = !property.bourseDataCompleted;
  const needsBourse = !skipsBourseForIdentifier(property.identifierType);
  const location = formatPropertyLocation(property);
  const typeLine = formatPropertyTypeLine(property);
  const deedDisplay = formatPropertyDeedDisplay(property);

  if (layout === "page") {
    if (!record) return null;
    return (
      <PoPropertyDetailTabs
        record={record}
        property={property}
        showDecree={showDecree}
      />
    );
  }

  return (
    <article className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface px-3.5 py-3">
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="text-[11px] font-bold tracking-wide text-text-3 uppercase">
            عقار {index}
          </span>
          <span className="text-sm font-bold text-primary" dir="ltr">
            {deedDisplay}
          </span>
          {needsBourse && boursePending ? (
            <Badge tone="warning" className="text-[11px] font-normal">
              بانتظار البورصة
            </Badge>
          ) : null}
          {needsBourse && !boursePending ? (
            <Badge tone="success" className="text-[11px] font-normal">
              بورصة مكتملة
            </Badge>
          ) : null}
        </div>
        {property.deedStatus ? (
          <Badge tone="warning" className="text-[11px] font-normal">
            {property.deedStatus}
          </Badge>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-text-3">الموقع</span>
          <span className="text-xs leading-snug text-text">
            {location || "—"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-text-3">
            التصنيف / النوع
          </span>
          <span className="text-xs leading-snug text-text">
            {typeLine || "—"}
          </span>
        </div>
        {hasBourseDetailFields(property) ? (
          <>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-text-3">
                المساحة
              </span>
              <span className="text-xs leading-snug text-text">
                {property.area || "—"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-text-3">
                القيود
              </span>
              <span className="text-xs leading-snug text-text">
                {restrictionsPresentLabel(property.restrictionsPresent) || "—"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-text-3">
                توفر الحدود
              </span>
              <span className="text-xs leading-snug text-text">
                {boundariesAvailabilityLabel(property.boundariesAvailability) ||
                  "—"}
              </span>
            </div>
          </>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-text-3">
            ضباط اتصال
          </span>
          <span className="text-xs leading-snug text-text">
            {contactCount} {contactCount === 1 ? "ضابط" : "ضباط"}
          </span>
        </div>
        {showsCourtFields(assignmentType) &&
          (property.court || property.circuit) && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-text-3">
                المحكمة / الدائرة
              </span>
              <span className="text-xs leading-snug text-text">
                {[property.court, property.circuit].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
      </div>

      {showDecree ? (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border pt-2.5">
          <span className="text-[10px] font-semibold text-text-3">
            مرفق قرار الإسناد
          </span>
          <AssignmentDocAttachment
            poNumber={poNumber}
            propertyId={property.id}
            fileName={property.assignmentDocFileName}
            variant="card"
          />
        </div>
      ) : null}
    </article>
  );
}
