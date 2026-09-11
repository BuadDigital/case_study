"use client";

/**
 * A4 preview of the approval page with the current draft (letterhead, margins, stamp and
 * signature at print size), plus a real-size test print with a ruler.
 */

import { useMemo, useRef } from "react";
import { AppModal, Button } from "@platform/ui-kit";
import { A4_PAPER_PX } from "./brand-identity-state";
import { brandTestPageHtml } from "./brand-test-page";
import type { BrandIdentityWorkflow } from "./useBrandIdentityWorkflow";

const PREVIEW_SCALE = 0.6;

export function BrandA4Preview({ workflow }: { workflow: BrandIdentityWorkflow }) {
  const { view, busy, closePreview } = workflow;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => brandTestPageHtml(view), [view]);

  return (
    <AppModal
      open
      title="معاينة صفحة الاعتماد على A4"
      subtitle={busy ? "بالقيم الحالية — بعضها قيد الحفظ" : "بالهوية المحفوظة حاليًا"}
      onClose={closePreview}
      maxWidthPx={560}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={closePreview}>
            إغلاق
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => frameRef.current?.contentWindow?.print()}
          >
            طباعة صفحة اختبار
          </Button>
        </>
      }
    >
      <div
        dir="ltr"
        className="mx-auto overflow-hidden rounded border border-border-md bg-[#e9e6df]"
        style={{
          width: A4_PAPER_PX.width * PREVIEW_SCALE,
          height: A4_PAPER_PX.height * PREVIEW_SCALE,
        }}
      >
        <iframe
          ref={frameRef}
          title="معاينة صفحة A4"
          srcDoc={html}
          className="block border-0"
          style={{
            width: A4_PAPER_PX.width,
            height: A4_PAPER_PX.height,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
          }}
        />
      </div>
      <p className="m-0 mt-2 text-[11px] leading-relaxed text-text-3">
        معاينة مصغّرة: الكليشة بشرائحها الأربع وهوامشها، والتوقيع والختم بمقاسهما في قسم
        الاعتماد (27). للتحقق الفعلي اطبع صفحة الاختبار بمقياس 100٪ وقِس مسطرة الـ 5 سم.
      </p>
    </AppModal>
  );
}
