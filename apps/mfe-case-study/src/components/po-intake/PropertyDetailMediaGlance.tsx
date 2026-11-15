"use client";

import type { ReactNode } from "react";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  openPropertyDetailDocumentPreview,
  type PropertyDetailDocumentEntry,
} from "../../lib/app-data/property-detail-documents";
import { cn, WORK_FORM_GRID_CLASS } from "@platform/ui-kit";
import { useInspectorPhotoDataUrl } from "../field-inspection/useInspectorPhotoDataUrl";
import { InsReadField } from "./PropertyDetailInspectionFields";
import { PropertyLocationMapGlance } from "./PropertyLocationMapGlance";
import { PropertyDetailPhotosTab } from "./PropertyDetailPhotosTab";
import { SummaryGroup } from "./SummaryGroup";

const goldSoft = "rounded border border-border bg-surface-2";

type PropertyGlanceFact = {
  label: string;
  value: string;
};

/**
 * Case Study.html basic-tab media strip: main photo + description | map + coords.
 *
 * How it works: «وصف العقار» is the text the caller hands in — the inspector's own description once
 * the specialist accepted it (or one the case-study staff wrote), or the appraiser page's «بانتظار
 * تأكيد الأخصائي» line; the work order's facts (basis of value, premise, purpose, report users) follow.
 * Edge cases / changed 2026-11-12 (Omar): the system no longer composes a description from the type,
 * the deed area and the district («أرض أرض، مساحة الأرض 123 م²، بحي …. يُحدَّث الوصف التفصيلي من
 * تقرير المعاين») — with no description the «وصف العقار» lines are left out, and with no fact either
 * the whole box is.
 * The appraiser's summary (Omar 2026-11-15) keeps the photo and the map as they are and orders the
 * rest its own way: with `factsAsGroup` the box holds the description alone and the work order's
 * facts follow as the «أساس التكليف» group of locked fields, after whatever `beforeFacts` hands in
 * (the study's groups) and before the photos.
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
  photos,
  factsAsGroup = false,
  beforeFacts,
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
  /**
   * Inspector photos to show while this strip is on screen (valuer basic tab).
   * Omit on the property overview — that page has its own photos tab.
   */
  photos?: PropertyDetailDocumentEntry[] | null;
  /** The work order's facts as the «أساس التكليف» group of fields, not lines of the description box. */
  factsAsGroup?: boolean;
  /** Drawn between the description and the work order's facts — the appraiser's study groups. */
  beforeFacts?: ReactNode;
}) {
  const handle = primaryPhoto?.inspectionPhoto;
  const fetchedUrl = useInspectorPhotoDataUrl(
    handle?.taskId,
    handle?.photoRef,
    handle?.attachment.attachmentId ? handle.attachment : null,
    !primaryPhoto?.dataUrl,
  );
  const heroUrl = primaryPhoto?.dataUrl || fetchedUrl;

  const hasPhoto = Boolean(heroUrl);
  const description = inspectorDescription?.trim() ?? "";

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
      ? { label: "مستخدم التقرير", value: reportUsersLabel.trim() }
      : null,
  ].filter((f): f is PropertyGlanceFact => Boolean(f));

  const boxFacts = factsAsGroup ? [] : assignmentFacts;
  const hasDescriptionBox = Boolean(description) || boxFacts.length > 0;
  const descriptionBlock = (
    <>
      {description ? (
        <>
          <div className="mb-[3px] text-[10.5px] text-text-2">وصف العقار</div>
          <p className="m-0 text-xs font-semibold leading-[1.7] text-pretty text-text">
            {description}
          </p>
        </>
      ) : null}
      {boxFacts.map((fact, i) => (
        <div
          key={fact.label}
          // The rule parts a fact from what stands above it; the first line of the box has none.
          className={cn(description || i > 0 ? "mt-2.5 border-t border-border/60 pt-2.5" : null)}
        >
          <div className="mb-[3px] text-[10.5px] text-text-2">{fact.label}</div>
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
          <div className="truncate text-[11px] text-text-2">
            صورة العقار الرئيسية
          </div>
          <span className="shrink-0 text-[10px] font-semibold text-gold-d">
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
            if (primaryPhoto)
              openPropertyDetailDocumentPreview(
                {
                  ...primaryPhoto,
                  dataUrl: heroUrl,
                },
                photos ?? undefined,
              );
          }}
          aria-label={
            hasPhoto
              ? "معاينة الصورة الرئيسية"
              : "لم يتم رفع صورة من قبل المعاين بعد"
          }
        >
          {hasPhoto && heroUrl ? (
            <img
              src={heroUrl}
              alt={primaryPhoto?.name || "صورة العقار الرئيسية"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-2 px-4 text-center text-[12px] text-text-3">
              لم يتم رفع صورة من قبل المعاين بعد
            </div>
          )}
        </button>
        {showCoordinates && hasDescriptionBox ? (
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
      {!showCoordinates && hasDescriptionBox ? (
        <div className={cn("sm:col-span-2 px-3 py-2", goldSoft)}>
          {descriptionBlock}
        </div>
      ) : null}
      {beforeFacts ? <div className="min-w-0 sm:col-span-2">{beforeFacts}</div> : null}
      {factsAsGroup && assignmentFacts.length > 0 ? (
        <div className="min-w-0 sm:col-span-2">
          <SummaryGroup title="أساس التكليف" testId="appraiser-assignment">
            <div className={WORK_FORM_GRID_CLASS}>
              {assignmentFacts.map((fact) => (
                <InsReadField key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          </SummaryGroup>
        </div>
      ) : null}
      {photos ? (
        <div className="sm:col-span-2 mt-1">
          <PropertyDetailPhotosTab
            photos={photos}
            marks={property?.photoMarks}
            showReportBoard={false}
          />
        </div>
      ) : null}
    </div>
  );
}
