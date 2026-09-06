"use client";

/**
 * Letterhead card: A4 thumbnail (click to zoom), the four margin inputs and
 * replace / delete / apply. The zoom overlay itself lives in
 * `BrandIdentityLetterheadZoom`.
 */

import { Button, Card, CardBody, CardHeader, Input, Label } from "@platform/ui-kit";
import { BRAND_CARD_FOOT_CLS, BRAND_FIELD_CLS } from "./BrandIdentityAssetCards";
import { LH_MARGIN_FIELDS, lhGuideValue } from "./brand-identity-state";
import type { BrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

/**
 * The four margin inputs. `bindDragInput` adds `data-lh-input` so the zoom
 * drag handler can paint the value without a React render.
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
          <Label size="field">{field.label}</Label>
          <Input
            className={BRAND_FIELD_CLS}
            type="number"
            dir="ltr"
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
  const { canEdit, dirty, saving, view, lhMeta, uploadAsset, deleteAsset, applyAsset, openZoom } =
    workflow;
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
            className="group relative h-[300px] w-[212px] cursor-zoom-in overflow-hidden rounded-lg border border-border-md bg-white p-0 shadow-[0_1px_0_rgba(16,43,78,.04),0_8px_24px_rgba(16,43,78,.08)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(16,43,78,.04),0_14px_32px_rgba(16,43,78,.12)]"
            onClick={openZoom}
          >
            <img
              src={view.letterhead}
              alt="معاينة الكليشة على A4"
              className="absolute inset-0 size-full object-cover"
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-dashed border-gold"
              style={{
                height: view.head * 0.9,
                background: "color-mix(in srgb, var(--gold) 12%, transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-dashed border-gold"
              style={{
                top: view.footTop * 0.9,
                background: "color-mix(in srgb, var(--gold) 12%, transparent)",
              }}
            />
            <span
              className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded px-2 py-0.5 text-[10.5px] text-white opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: "color-mix(in srgb, var(--ink) 72%, transparent)" }}
            >
              اضغط للتكبير وضبط الهوامش
            </span>
          </button>
          <span className="text-[11px] text-text-3">نسبة العرض مطابقة لصفحة A4</span>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
          <LetterheadMarginFields workflow={workflow} disabled={!canEdit} />
          <p className="m-0 text-[11.5px] leading-relaxed text-text-3 sm:col-span-2">
            اضغط على الصفحة لتكبيرها وسحب الأشرطة لضبط الهوامش بدقة — الباترن يبقى خارج
            منطقة المحتوى.
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
            <Button
              variant="dangerOutline"
              size="sm"
              disabled={!canEdit}
              onClick={() => deleteAsset("letterhead")}
            >
              حذف
            </Button>
          </div>
        </div>
      </CardBody>
      <div className={BRAND_CARD_FOOT_CLS}>
        <span>{lhMeta}</span>
        <Button
          variant="primary"
          size="sm"
          disabled={!canEdit || !dirty.lh || saving}
          onClick={() => applyAsset("lh")}
        >
          اعتماد وتطبيق
        </Button>
      </div>
    </Card>
  );
}
