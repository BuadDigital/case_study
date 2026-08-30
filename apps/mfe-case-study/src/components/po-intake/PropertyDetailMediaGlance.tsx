"use client";

import {
  buildPropertyDescriptionLine,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";
import { cn } from "@platform/ui-kit";
import { PropertyLocationMapGlance } from "./PropertyLocationMapGlance";

const goldSoft =
  "rounded border border-transparent bg-[color-mix(in_srgb,#f1ece2_45%,transparent)]";

export type PropertyGlanceFact = {
  label: string;
  value: string;
};

/**
 * Case Study.html basic-tab media strip: main photo + description | map + coords.
 */
export function PropertyDetailMediaGlance({
  property,
  primaryPhoto,
  inspectorDescription,
  latitude,
  longitude,
  showCoordinates = true,
  valueBasisLabel,
  valuePremiseLabel,
  valuationPurposeLabel,
  reportUsersLabel,
}: {
  property?: PoPropertyIntake | null;
  primaryPhoto?: PropertyDetailDocumentEntry | null;
  inspectorDescription?: string;
  latitude?: string | null;
  longitude?: string | null;
  showCoordinates?: boolean;
  /** Value basis in use — shown under the property description (from the work order). */
  valueBasisLabel?: string | null;
  /** Value premise — under value basis. */
  valuePremiseLabel?: string | null;
  /** Purpose of valuation — under value basis. */
  valuationPurposeLabel?: string | null;
  /** Report users — under value basis. */
  reportUsersLabel?: string | null;
}) {
  const hasPhoto = Boolean(primaryPhoto?.dataUrl);
  const description = property
    ? buildPropertyDescriptionLine(property, inspectorDescription)
    : inspectorDescription?.trim() ||
      "يُحدَّث الوصف التفصيلي من تقرير المعاين.";

  const assignmentFacts: PropertyGlanceFact[] = [
    valueBasisLabel?.trim()
      ? { label: "أساس القيمة المستخدم", value: valueBasisLabel.trim() }
      : null,
    valuePremiseLabel?.trim()
      ? { label: "فرضية القيمة", value: valuePremiseLabel.trim() }
      : null,
    valuationPurposeLabel?.trim()
      ? { label: "الغرض من التقييم", value: valuationPurposeLabel.trim() }
      : null,
    reportUsersLabel?.trim()
      ? { label: "مستخدمو التقرير", value: reportUsersLabel.trim() }
      : null,
  ].filter((f): f is PropertyGlanceFact => Boolean(f));

  const descriptionBlock = (
    <>
      <div className="mb-[3px] text-[10.5px] text-text-3">وصف العقار</div>
      <p className="m-0 text-xs font-semibold leading-[1.7] text-pretty text-text">
        {description}
      </p>
      {assignmentFacts.map((fact) => (
        <div
          key={fact.label}
          className="mt-2.5 border-t border-border/60 pt-2.5"
        >
          <div className="mb-[3px] text-[10.5px] text-text-3">{fact.label}</div>
          <p className="m-0 text-xs font-semibold leading-[1.7] text-pretty text-text">
            {fact.value}
          </p>
        </div>
      ))}
    </>
  );

  return (
    <div className="mb-1 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <div className="flex min-w-0 flex-col">
        <div className="mb-1.5 flex min-w-0 items-center justify-between gap-1.5">
          <div className="truncate text-[11px] text-text-3">
            صورة العقار الرئيسية
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-[#8c7857]">
            من المعاين
          </span>
        </div>
        <button
          type="button"
          className={cn(
            "relative block h-[200px] w-full overflow-hidden rounded border border-border bg-surface-2 p-0",
            hasPhoto ? "cursor-pointer" : "cursor-default",
          )}
          disabled={!hasPhoto}
          onClick={() => {
            if (primaryPhoto) openPropertyDetailDocumentPreview(primaryPhoto);
          }}
          aria-label={
            hasPhoto ? "معاينة الصورة الرئيسية" : "لا توجد صورة رئيسية بعد"
          }
        >
          {hasPhoto && primaryPhoto?.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryPhoto.dataUrl}
              alt={primaryPhoto.name || "صورة العقار الرئيسية"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-2 text-[11px] text-text-3">
              لا توجد صورة بعد
            </div>
          )}
        </button>
        {showCoordinates ? (
          <div className={cn("mt-2 flex-1 px-3 py-2", goldSoft)}>
            {descriptionBlock}
          </div>
        ) : null}
      </div>

      <PropertyLocationMapGlance
        property={property}
        latitude={latitude}
        longitude={longitude}
        showCoordinates={showCoordinates}
      />
      {!showCoordinates ? (
        <div className={cn("sm:col-span-2 px-3 py-2", goldSoft)}>
          {descriptionBlock}
        </div>
      ) : null}
    </div>
  );
}
