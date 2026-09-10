"use client";

/**
 * Letterhead zoom overlay: the A4 page fitted to the window with zoom controls, draggable
 * gold guides (edit capability only) and Space + drag to pan. Behaviour lives in
 * `useBrandLetterheadZoom`.
 */

import type { CSSProperties } from "react";
import { Button } from "@platform/ui-kit";
import { LetterheadMarginFields } from "./BrandIdentityLetterheadCard";
import { A4_PAPER_PX, lhGuideCssVars } from "./brand-identity-state";
import type { BrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

const GUIDE_STRIPE =
  "repeating-linear-gradient(90deg, var(--gold) 0 4px, transparent 4px 8px) center/100% 2px no-repeat";
const GUIDE_TINT = "color-mix(in srgb, var(--gold) 14%, transparent)";

export function BrandLetterheadZoom({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { view, canEdit, marginError, zoom } = workflow;
  const {
    pan,
    x,
    y,
    scale,
    zoomRef,
    paperRef,
    frameRef,
    startDrag,
    startPan,
    closeZoom,
    fit,
    zoomIn,
    zoomOut,
    actualSize,
  } = zoom;

  return (
    <div
      className="fixed inset-0 z-[1400] grid place-items-center p-6"
      style={{ background: "rgba(16,43,78,.45)" }}
      role="dialog"
      aria-modal
      aria-label="ضبط هوامش الكليشة"
    >
      <div
        ref={zoomRef}
        className="flex max-h-[94vh] items-start gap-4 rounded-xl bg-surface p-4"
        style={lhGuideCssVars(view) as CSSProperties}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button variant="default" size="sm" onClick={fit}>
              ملاءمة الصفحة
            </Button>
            <Button variant="default" size="sm" aria-label="تصغير" onClick={zoomOut}>
              −
            </Button>
            <span
              className="min-w-[3.5rem] text-center text-[12px] font-bold text-heading"
              dir="ltr"
            >
              {Math.round(scale * 100)}%
            </span>
            <Button variant="default" size="sm" aria-label="تكبير" onClick={zoomIn}>
              +
            </Button>
            <Button variant="default" size="sm" onClick={actualSize}>
              الحجم الطبيعي
            </Button>
          </div>
          <div
            ref={frameRef}
            className="relative h-[78vh] w-[min(720px,58vw)] overflow-hidden border border-border-md bg-surface-2"
          >
            <div
              ref={paperRef}
              className="absolute bg-white shadow-[0_6px_24px_rgba(16,43,78,.18)]"
              style={{
                top: 0,
                insetInlineStart: 0,
                width: A4_PAPER_PX.width,
                height: A4_PAPER_PX.height,
                transform: `translate(${x}px, ${y}px) scale(${scale})`,
                transformOrigin: "top right",
                cursor: pan ? "grab" : "default",
              }}
            >
              {pan ? (
                <div className="absolute inset-0 z-[5] cursor-grab" onMouseDown={startPan} />
              ) : null}
              <img
                src={view.letterhead}
                alt="معاينة الكليشة على A4"
                className="absolute inset-0 size-full object-fill"
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 border-b-2 border-gold"
                style={{ height: "var(--lh-head)", background: GUIDE_TINT }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-gold"
                style={{ top: "var(--lh-foot)", background: GUIDE_TINT }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 border-s-2 border-dotted border-gold"
                style={{ insetInlineEnd: 0, width: "var(--lh-pad)", background: GUIDE_TINT }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 border-e-2 border-dotted border-gold"
                style={{
                  insetInlineStart: 0,
                  width: "var(--lh-pad-start)",
                  background: GUIDE_TINT,
                }}
              />
              {canEdit ? (
                <>
                  <div
                    className="absolute inset-x-0 h-4 cursor-ns-resize"
                    style={{ top: "calc(var(--lh-head) - 8px)", background: GUIDE_STRIPE }}
                    onMouseDown={(e) => startDrag(e, "letterheadHeadMm", "y")}
                  />
                  <div
                    className="absolute inset-x-0 h-4 cursor-ns-resize"
                    style={{ top: "calc(var(--lh-foot) - 8px)", background: GUIDE_STRIPE }}
                    onMouseDown={(e) => startDrag(e, "letterheadFootTopMm", "y")}
                  />
                  <div
                    className="absolute inset-y-0 w-4 cursor-ew-resize"
                    style={{ insetInlineEnd: "calc(var(--lh-pad) - 8px)" }}
                    onMouseDown={(e) => startDrag(e, "letterheadPadMm", "x")}
                  />
                  <div
                    className="absolute inset-y-0 w-4 cursor-ew-resize"
                    style={{ insetInlineStart: "calc(var(--lh-pad-start) - 8px)" }}
                    onMouseDown={(e) => startDrag(e, "letterheadPadStartMm", "xs")}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-[190px] shrink-0 flex-col gap-2">
          <div className="text-[13px] font-bold text-heading">ضبط هوامش الكليشة</div>
          <LetterheadMarginFields workflow={workflow} disabled={!canEdit} bindDragInput />
          {marginError ? (
            <p role="alert" className="m-0 text-[11.5px] text-danger-text">
              {marginError}
            </p>
          ) : null}
          <p className="m-0 text-[11.5px] leading-relaxed text-text-3">
            {canEdit ? (
              <>
                اسحب الشريط الذهبي أو اكتب القيمة. اضغط <kbd>مسافة</kbd> مع السحب لتحريك
                الصفحة، و<bdi dir="ltr">Esc</bdi> للإغلاق.
              </>
            ) : (
              "عرض فقط — تعديل الهوامش يتطلب صلاحية ضبط النظام."
            )}
          </p>
          <Button variant="primary" onClick={closeZoom}>
            تم
          </Button>
        </div>
      </div>
    </div>
  );
}
