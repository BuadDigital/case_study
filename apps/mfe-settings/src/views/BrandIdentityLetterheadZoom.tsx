"use client";

/**
 * Full-size A4 letterhead overlay: draggable gold guides paint CSS vars on the
 * root (no React render per mouse move), Space + drag pans the page.
 */

import type { CSSProperties } from "react";
import { Button } from "@platform/ui-kit";
import { LetterheadMarginFields } from "./BrandIdentityLetterheadCard";
import { lhGuideCssVars } from "./brand-identity-state";
import type { BrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

const GUIDE_STRIPE =
  "repeating-linear-gradient(90deg, var(--gold) 0 4px, transparent 4px 8px) center/100% 2px no-repeat";
const GUIDE_TINT = "color-mix(in srgb, var(--gold) 14%, transparent)";

export function BrandLetterheadZoom({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { view, lhPan, lhX, lhY, lhZoomRef, lhPaperRef, startDrag, startPan, closeZoom } =
    workflow;
  return (
    <div
      className="fixed inset-0 z-[1400] grid place-items-center p-6"
      style={{ background: "rgba(16,43,78,.45)" }}
    >
      <div
        ref={lhZoomRef}
        className="flex max-h-[92vh] items-start gap-4 rounded-xl bg-surface p-4"
        style={lhGuideCssVars(view) as CSSProperties}
      >
        <div className="relative h-[70vh] w-[540px] overflow-hidden border border-border-md bg-surface-2">
          <div
            ref={lhPaperRef}
            className="absolute bg-white shadow-[0_6px_24px_rgba(16,43,78,.18)]"
            style={{
              top: 0,
              insetInlineStart: 0,
              width: 794,
              height: 1123,
              transform: `translate(${lhX}px, ${lhY}px)`,
              cursor: lhPan ? "grab" : "default",
            }}
          >
            {lhPan ? (
              <div className="absolute inset-0 z-[5] cursor-grab" onMouseDown={startPan} />
            ) : null}
            <img
              src={view.letterhead}
              alt="معاينة الكليشة على A4"
              className="absolute inset-0 size-full object-cover"
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
              className="absolute inset-x-0 h-2.5 cursor-ns-resize"
              style={{ top: "calc(var(--lh-head) - 5px)", background: GUIDE_STRIPE }}
              onMouseDown={(e) => startDrag(e, "letterheadHeadMm", "y")}
            />
            <div
              className="absolute inset-x-0 h-2.5 cursor-ns-resize"
              style={{ top: "calc(var(--lh-foot) - 5px)", background: GUIDE_STRIPE }}
              onMouseDown={(e) => startDrag(e, "letterheadFootTopMm", "y")}
            />
            <div
              className="absolute inset-y-0 cursor-ew-resize border-s-2 border-dotted border-gold"
              style={{ insetInlineEnd: 0, width: "var(--lh-pad)", background: GUIDE_TINT }}
              onMouseDown={(e) => startDrag(e, "letterheadPadMm", "x")}
            />
            <div
              className="absolute inset-y-0 cursor-ew-resize border-e-2 border-dotted border-gold"
              style={{
                insetInlineStart: 0,
                width: "var(--lh-pad-start)",
                background: GUIDE_TINT,
              }}
              onMouseDown={(e) => startDrag(e, "letterheadPadStartMm", "xs")}
            />
          </div>
        </div>
        <div className="flex w-[180px] shrink-0 flex-col gap-2">
          <div className="text-[13px] font-bold text-heading">ضبط هوامش الكليشة</div>
          <LetterheadMarginFields workflow={workflow} bindDragInput />
          <p className="m-0 text-[11.5px] text-text-3">
            الصفحة بالحجم الطبيعي <span>A4</span>. اسحب الشريط الذهبي أو اكتب القيمة، واضغط{" "}
            <strong>مسافة</strong> مع السحب لتحريك الصفحة.
          </p>
          <Button variant="primary" onClick={closeZoom}>
            تم
          </Button>
        </div>
      </div>
    </div>
  );
}
