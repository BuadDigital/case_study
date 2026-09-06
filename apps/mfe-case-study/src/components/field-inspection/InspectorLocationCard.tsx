"use client";

/**
 * Step-1 card «بيانات المعاينة»: device GPS capture, the lat/lng inputs,
 * inspection date/time, the movable map, and the pin/undo controls.
 * Lifted out of `FieldInspectionWorkBody` — same markup, state stays with
 * the workflow hook.
 */
import { cn, Input } from "@platform/ui-kit";
import { JEDDAH_DEFAULT_LAT, JEDDAH_DEFAULT_LNG } from "@platform/app-shared/domain/jeddah-default-coords";
import {
  mapPinPatchForActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  EDIT_CONTROL_CLASS,
  InsBadge,
  InspectorCard,
  MobileInspectMap,
} from "./FieldInspectionWorkParts";
import { InspectorSaveChip } from "./InspectorSaveChip";
import {
  canPinInspectorMap,
  inspectorMapCoordsLabel,
} from "./field-inspection-work-state";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function InspectorLocationCard({
  activeStep,
  captureDeviceGps,
  draft,
  fieldErrors,
  layout,
  locked,
  mapBackup,
  mapPinEpoch,
  mapPinned,
  mobile,
  persist,
  property,
  requestMapMove,
  saveState,
  setMapPinned,
  showToast,
  undoMapMove,
}: Pick<
  FieldInspectionWorkflow,
  | "activeStep"
  | "captureDeviceGps"
  | "fieldErrors"
  | "locked"
  | "mapBackup"
  | "mapPinEpoch"
  | "mapPinned"
  | "persist"
  | "property"
  | "requestMapMove"
  | "saveState"
  | "setMapPinned"
  | "showToast"
  | "undoMapMove"
> & {
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
}) {
  return (
    <div id="ins-map-section">
    <InspectorCard
      title="بيانات المعاينة"
      hidden={activeStep !== 1}
      icon="ti-clipboard-check"
      badge={
        <span className="flex items-center gap-2">
          <InspectorSaveChip state={saveState.location} />
          {mobile ? null : <InsBadge label="إلزامي" tone="danger" />}
        </span>
      }
      layout={layout}
      step={1}
      subtitle={mobile ? "موقع GPS للعقار" : undefined}
      defaultOpen
    >
      {mobile ? (
        <div className="mb-2 text-[13px] font-bold text-heading">
          موقع العقار (GPS)
        </div>
      ) : (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-text-2">
            موقع العقار على الخريطة (GPS)
          </span>
          <InsBadge label="مشترك" tone="purple" />
          <span className="text-[10.5px] text-text-3">
            — إثبات النزول الميداني
          </span>
        </div>
      )}
      <button
        type="button"
        disabled={locked}
        className={cn(
          "mb-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-inherit text-[14px] font-bold text-ink",
          !mobile && "min-h-10 text-[13px]",
        )}
        onClick={captureDeviceGps}
      >
        <i className="ti ti-current-location text-base" aria-hidden />
        تحديد موقعي الحالي
      </button>
      {!mobile ? (
        <div className="mb-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold text-text-2">
              خط العرض
            </div>
            <Input
              id="ins-lat"
              dir="ltr"
              className={EDIT_CONTROL_CLASS}
              disabled={locked}
              value={draft.mapLatitude}
              placeholder={JEDDAH_DEFAULT_LAT}
              onChange={(e) =>
                persist(
                  mapPinPatchForActor(
                    draft,
                    e.target.value,
                    draft.mapLongitude,
                    "inspector",
                  ),
                )
              }
            />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold text-text-2">
              خط الطول
            </div>
            <Input
              id="ins-lng"
              dir="ltr"
              className={EDIT_CONTROL_CLASS}
              disabled={locked}
              value={draft.mapLongitude}
              placeholder={JEDDAH_DEFAULT_LNG}
              onChange={(e) =>
                persist(
                  mapPinPatchForActor(
                    draft,
                    draft.mapLatitude,
                    e.target.value,
                    "inspector",
                  ),
                )
              }
            />
          </div>
        </div>
      ) : null}
      {fieldErrors.mapLatitude ? (
        <p className="mb-3 text-[11px] font-semibold text-danger-text" role="alert">
          {fieldErrors.mapLatitude}
        </p>
      ) : null}
      {!mobile ? (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold text-text-2">
              تاريخ المعاينة
            </div>
            <p
              id="ins-date"
              dir="ltr"
              className="m-0 text-[13px] font-semibold text-heading"
            >
              {draft.inspectionDate || "—"}
            </p>
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold text-text-2">
              وقت المعاينة
            </div>
            <p
              id="ins-time"
              dir="ltr"
              className="m-0 text-[13px] font-semibold text-heading"
            >
              {draft.inspectionTime || "—"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-[11px] text-text-2">التاريخ</div>
            <p
              id="ins-date"
              dir="ltr"
              className="m-0 text-[13px] font-semibold text-heading"
            >
              {draft.inspectionDate || "—"}
            </p>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-text-2">الوقت</div>
            <p
              id="ins-time"
              dir="ltr"
              className="m-0 text-[13px] font-semibold text-heading"
            >
              {draft.inspectionTime || "—"}
            </p>
          </div>
        </div>
      )}
      <MobileInspectMap
        key={`${draft.mapLatitude},${draft.mapLongitude},${mapPinEpoch}`}
        latitude={draft.mapLatitude}
        longitude={draft.mapLongitude}
        property={property}
        heightClass={mobile ? "h-[180px] rounded-xl" : "h-[200px]"}
        interactive={!locked && !mapPinned}
        onCoordsChange={
          locked || mapPinned
            ? undefined
            : (lat, lng) => requestMapMove(lat, lng)
        }
      />
      {!locked ? (
        <div className="mt-2 flex flex-col gap-2">
          {canPinInspectorMap(draft.mapLatitude, draft.mapLongitude, mapPinned) ? (
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-inherit font-bold text-ink",
                mobile ? "min-h-12 text-[14px]" : "min-h-11 text-[13px]",
              )}
              onClick={() => {
                setMapPinned(true);
                showToast("تم تثبيت الموقع", "success");
              }}
            >
              <i className="ti ti-pin text-base" aria-hidden />
              تثبيت الموقع
            </button>
          ) : null}
          {mapPinned ? (
            <div className="flex gap-2">
              <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#B7E4C7] bg-[#F0FFF4] text-[13px] font-bold text-[#1B7A4A]">
                <i className="ti ti-pin-filled text-base" aria-hidden />
                الموقع مثبت
              </div>
              <button
                type="button"
                className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-3 font-inherit text-[13px] font-bold text-heading"
                onClick={() => setMapPinned(false)}
              >
                تعديل
              </button>
            </div>
          ) : null}
          {mapBackup ? (
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface font-inherit text-[13px] font-bold text-heading"
              onClick={undoMapMove}
            >
              <i className="ti ti-arrow-back-up text-base" aria-hidden />
              رجوع للموقع السابق
            </button>
          ) : null}
        </div>
      ) : null}
      {mobile ? (
        <div className="mt-1.5 text-center text-[12px] text-text-3" dir="ltr">
          {inspectorMapCoordsLabel(draft.mapLatitude, draft.mapLongitude)}
        </div>
      ) : null}
    </InspectorCard>
    </div>
  );
}
