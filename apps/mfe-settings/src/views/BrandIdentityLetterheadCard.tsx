"use client";

/**
 * Letterhead card: A4 thumbnail with all four margin guides at true proportion (click to
 * zoom), the margin inputs with a sanity check, replace / reset / A4 preview, and apply.
 * The zoom overlay lives in `BrandIdentityLetterheadZoom`.
 */

import { Button, Card, CardBody, CardHeader, Input, Label } from "@platform/ui-kit";
import {
  BRAND_FIELD_CLS,
  BrandCardFooter,
  ResetDefaultButton,
} from "./BrandIdentityAssetCards";
import { LH_MARGIN_FIELDS, LH_THUMB, lhGuideValue, lhThumbGuides } from "./brand-identity-state";
import type { BrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

const BAND_TINT = "color-mix(in srgb, var(--gold) 12%, transparent)";

/**
 * The four margin inputs. `bindDragInput` adds `data-lh-input` so the zoom drag handler can
 * paint the value without a React render.
 */
export function LetterheadMarginFields({
  workflow,
  disabled,
  bindDragInput,
}: {
  workflow: BrandIdentityWorkflow;
  disabled?: boolean;
  bindDragInput?: boolean;
}) {
  const { view, patchLh } = workflow;
  return (
    <>
      {LH_MARGIN_FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col">
          <Label size="field" htmlFor={`${field.key}-${bindDragInput ? "zoom" : "card"}`}>
            {field.label}
          </Label>
          <Input
            id={`${field.key}-${bindDragInput ? "zoom" : "card"}`}
            className={BRAND_FIELD_CLS}
            type="number"
            dir="ltr"
            min={0}
            max={field.key === "letterheadPadMm" || field.key === "letterheadPadStartMm" ? 210 : 297}
            disabled={disabled}
            data-lh-input={bindDragInput ? field.key : undefined}
            value={String(lhGuideValue(view, field.key))}
            onChange={(e) => patchLh(field.key, e.target.value)}
          />
        </div>
      ))}
    </>
  );
}

export function BrandLetterheadCard({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { canEdit, view, lhMeta, marginError, uploadAsset, openPreview, zoom } = workflow;
  const guides = lhThumbGuides(view);
  return (
    <Card>
      <CardHeader className="items-baseline gap-2">
        <h2 className="m-0 text-sm font-bold">كليشة التقرير</h2>
        <span className="text-[11.5px] font-normal text-text-3">
          معاينة A4 مع ضبط الهوامش الأربعة
        </span>
      </CardHeader>
      <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <button
            type="button"
            className="group relative cursor-zoom-in overflow-hidden rounded-lg border border-border-md bg-white p-0 shadow-[0_1px_0_rgba(16,43,78,.04),0_8px_24px_rgba(16,43,78,.08)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(16,43,78,.04),0_14px_32px_rgba(16,43,78,.12)]"
            style={{ width: LH_THUMB.widthPx, height: LH_THUMB.heightPx }}
            onClick={zoom.openZoom}
          >
            <img
              src={view.letterhead}
              alt="معاينة الكليشة على A4"
              className="absolute inset-0 size-full object-fill"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-dashed border-gold"
              style={{ height: guides.headPx, background: BAND_TINT }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-dashed border-gold"
              style={{ top: guides.footTopPx, background: BAND_TINT }}
            />
            <div
              className="pointer-events-none absolute border-s border-dashed border-gold"
              style={{
                top: guides.headPx,
                height: Math.max(0, guides.footTopPx - guides.headPx),
                insetInlineEnd: 0,
                width: guides.padPx,
                background: BAND_TINT,
              }}
            />
            <div
              className="pointer-events-none absolute border-e border-dashed border-gold"
              style={{
                top: guides.headPx,
                height: Math.max(0, guides.footTopPx - guides.headPx),
                insetInlineStart: 0,
                width: guides.padStartPx,
                background: BAND_TINT,
              }}
            />
            <span
              className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded px-2 py-0.5 text-[10.5px] text-white opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: "color-mix(in srgb, var(--ink) 72%, transparent)" }}
            >
              اضغط للتكبير وضبط الهوامش
            </span>
          </button>
          <span className="text-[11px] text-text-3">المقاسات مطابقة لنسبة صفحة A4</span>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
          <LetterheadMarginFields workflow={workflow} disabled={!canEdit} />
          {marginError ? (
            <p role="alert" className="m-0 text-[11.5px] text-danger-text sm:col-span-2">
              {marginError}
            </p>
          ) : null}
          <p className="m-0 text-[11.5px] leading-relaxed text-text-3 sm:col-span-2">
            اضغط على الصفحة لتكبيرها وسحب الأشرطة لضبط الهوامش بدقة — الباترن يبقى خارج
            منطقة المحتوى. الكليشة صفحة A4 كاملة، PNG أو JPG بعرض 1240 بكسل على الأقل أو SVG،
            حتى 3MB.
          </p>
          <div className="flex flex-wrap gap-1.5 sm:col-span-2">
            <Button
              variant="default"
              size="sm"
              disabled={!canEdit}
              onClick={() => uploadAsset("letterhead")}
            >
              استبدال الكليشة
            </Button>
            <Button variant="default" size="sm" onClick={openPreview}>
              معاينة على A4
            </Button>
            <ResetDefaultButton workflow={workflow} cardKey="lh" />
          </div>
        </div>
      </CardBody>
      <BrandCardFooter workflow={workflow} cardKey="lh" meta={lhMeta} />
    </Card>
  );
}
